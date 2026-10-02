"""The attack loop: run objectives against a target, judge, verify, and record findings.

This is the orchestrator that ties providers, target, strategies, judge, reliability, evidence, and
findings together (see docs/attack-engine/OVERVIEW.md). It owns provider lifetimes via
provider_scope and refuses unauthorized targets.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from ..config import Config
from ..data import Finding, Objective, Outcome, TaxonomyRef
from ..findings.engine import build_evidence, build_finding
from ..judges.judge import Judge
from ..providers.factory import build_provider, provider_scope
from ..reliability.replay import measure_reliability
from ..strategies.base import StrategyContext
from ..strategies.registry import get_strategy
from ..targets.factory import build_target
from .planner import Planner


@dataclass
class AttemptRecord:
    """One transcript line for the report: what we sent and what the model replied."""
    objective: str
    strategy: str
    prompt_sent: str
    model_response: str
    outcome: str  # success | partial | refused | error
    score: int
    objective_category: str = ""  # carried for per-category analytics (Phase 8)


@dataclass
class RunResult:
    run_id: str
    findings: list[Finding] = field(default_factory=list)
    calibration: dict = field(default_factory=dict)
    objectives_run: int = 0
    notes: list[str] = field(default_factory=list)
    attempts: list[AttemptRecord] = field(default_factory=list)


def _emit_noop(_m: str) -> None:
    return None


async def run_config(
    config: Config,
    *,
    store=None,
    emit=_emit_noop,
    run_id: str | None = None,
) -> RunResult:
    """Run every objective in a config.

    `store` is an optional RunStore; `emit` is a progress callback.
    """
    config.require_full()
    config.require_authorized_target()
    config.require_objectives()

    run_id = run_id or uuid.uuid4().hex
    result = RunResult(run_id=run_id)
    planner = Planner()
    config_snapshot = _config_snapshot(config)

    async with provider_scope():
        egress = config.security.egress.policy()  # every model call passes the egress guard
        attacker_provider = build_provider(config.attacker, egress)  # for strategies that reason
        target_provider = build_provider(config.target, egress)
        judge_provider = build_provider(config.judge, egress)

        target = build_target(config.target, target_provider)
        judge = Judge(judge_provider)

        if store:
            project_name = (config.project or {}).get("name")
            store.event("run_meta", target_model=config.target.model,
                        target_provider=config.target.protocol, run_id=run_id,
                        target_type=config.target.type or "chat",
                        project_name=str(project_name) if project_name else None)

        result.calibration = await judge.calibrate()
        if store:
            store.event("calibration", **result.calibration)
        if not result.calibration.get("calibrated", False):
            result.notes.append(
                "judge not calibrated: it flagged a benign fixture; treat findings with care"
            )

        from ..campaigns.engine import build_budget, execute_campaign

        budget = build_budget(config)

        async def run_one(objective: Objective):
            return await _run_objective(
                objective=objective,
                config=config,
                planner=planner,
                target=target,
                attacker_provider=attacker_provider,
                judge=judge,
                judge_provider=judge_provider,
                run_id=run_id,
                store=store,
                emit=emit,
                config_snapshot=config_snapshot,
                budget=budget,
            )

        await execute_campaign(
            config=config,
            objectives=config.objectives,
            run_one=run_one,
            result=result,
            budget=budget,
            emit=emit,
        )

    return result


async def _run_objective(
    *,
    objective: Objective,
    config: Config,
    planner: Planner,
    target,
    attacker_provider,
    judge: Judge,
    judge_provider,
    run_id: str,
    store,
    emit,
    config_snapshot: dict,
    budget=None,
) -> tuple[Finding | None, list[AttemptRecord]]:
    records: list[AttemptRecord] = []
    sequence = planner.select_sequence(objective, config)
    for strategy_name in sequence:
        # Budgets are checked before each strategy, so a running objective stops cleanly.
        if budget is not None:
            exhausted, why = budget.exhausted()
            if exhausted:
                emit(f"{objective.title}: stopping before {strategy_name} ({why})")
                break
        strategy = get_strategy(strategy_name)
        # Capability check: skip a strategy the target cannot support.
        if not strategy.required_target_capabilities.issubset(target.capabilities()):
            emit(f"skip {strategy_name}: target missing required capabilities")
            continue

        from ..data import AttackPlan

        plan = AttackPlan(
            objective_id=objective.id,
            strategy=strategy_name,
            rationale=planner.rationale(objective, config, strategy_name),
        )
        if store:
            store.event("attack_plan", objective=objective.title, strategy=strategy_name,
                        rationale=plan.rationale)

        from ..payloads import PayloadEngine

        ctx = StrategyContext(
            objective=objective, target=target, plan_id=plan.id,
            attacker=attacker_provider, judge=judge, judge_provider=judge_provider,
            params=dict(config.attack.params), payloads=PayloadEngine(), emit=emit,
        )
        strat_result = await strategy.run(ctx)

        # Account this strategy's attempts and target tokens against the campaign budget.
        if budget is not None:
            budget.record(
                attempts=len(strat_result.runs),
                tokens=sum(_obs_tokens(sr.observation) for sr in strat_result.runs),
            )

        # Judge each attempt; keep the strongest.
        best = None  # (verdict, run)
        for srun in strat_result.runs:
            verdict = await judge.judge(srun.observation, objective, srun.attempt.payload)
            records.append(AttemptRecord(
                objective=objective.title, strategy=strategy_name,
                prompt_sent=srun.attempt.payload, model_response=srun.observation.response,
                outcome=verdict.outcome.value, score=verdict.score,
                objective_category=objective.category,
            ))
            if store:
                store.event("attempt", objective=objective.title, strategy=strategy_name,
                            payload=srun.attempt.payload, response=srun.observation.response,
                            outcome=verdict.outcome.value, score=verdict.score,
                            category=objective.category)
            if best is None or verdict.score > best[0].score:
                best = (verdict, srun)

        if best is None:
            continue
        verdict, srun = best
        if verdict.outcome is not Outcome.SUCCESS:
            emit(f"{strategy_name}: no success (best score {verdict.score}/10), "
                 "trying next strategy")
            continue

        # Verify with replay before it becomes a finding.
        emit(f"{strategy_name}: success (score {verdict.score}/10); verifying with replay")
        reliability = await measure_reliability(
            target=target, judge=judge, objective=objective,
            payload=srun.attempt.payload, attempt_id=srun.attempt.id,
            n=config.engine.replays, threshold=config.engine.reliable_threshold,
            backend_pinned=bool(config.target.provider_pin),
        )
        if store:
            store.event("reliability", strategy=strategy_name,
                        rate=reliability.success_rate, confidence=reliability.confidence.value)

        if reliability.confidence.value == "does_not_hold":
            emit(f"{strategy_name}: did not hold on replay; not a finding")
            continue

        candidate_tax: list[TaxonomyRef] = [
            *strategy.candidate_taxonomy, *objective.candidate_taxonomy
        ]
        target_meta = await target.get_metadata()
        evidence = build_evidence(
            objective=objective, attempt=srun.attempt, observation=srun.observation,
            verdict=verdict, reliability=reliability, target_meta=target_meta,
            config_snapshot=config_snapshot, strategy=strategy_name,
            strategy_params=dict(plan.strategy_params),
        )
        finding = build_finding(
            objective=objective, attempt=srun.attempt, verdict=verdict, reliability=reliability,
            candidate_taxonomy=candidate_tax, run_id=run_id, evidence_id=evidence.id,
        )
        evidence.finding_id = finding.id
        if store:
            store.save_evidence(evidence)
            store.save_finding(finding)
            store.event("finding", id=finding.id, severity=finding.severity.value,
                        title=finding.title, strategy=strategy_name)
        emit(f"FINDING: {finding.severity.value} - {finding.title}")
        return finding, records

    return None, records


def _obs_tokens(observation) -> int:
    """Target tokens (prompt + completion) reported for one observation, for budget accounting."""
    meta = observation.target_meta or {}
    return int(meta.get("prompt_tokens") or 0) + int(meta.get("completion_tokens") or 0)


def _config_snapshot(config: Config) -> dict:
    """A redaction-safe snapshot of the config for evidence.

    No secrets: only env var names are stored.
    """
    def ep(e):
        if e is None:
            return None
        return {"protocol": e.protocol, "model": e.model, "base_url": e.base_url,
                "api_key_env": e.api_key_env}
    return {
        "attacker": ep(config.attacker),
        "target": ep(config.target),
        "judge": ep(config.judge),
        "attack": config.attack.model_dump(),
        "engine": config.engine.model_dump(),
    }
