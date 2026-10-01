"""The attack loop: run objectives against a target, judge, verify, and record findings.

This is the orchestrator that ties providers, target, strategies, judge, reliability, evidence, and
findings together (see docs/attack-engine/OVERVIEW.md). It owns provider lifetimes via provider_scope
and refuses unauthorized targets.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from ..config import Config
from ..data import Finding, Objective, Outcome, TaxonomyRef
from ..judges.judge import Judge
from ..providers.factory import build_provider, provider_scope
from ..reliability.replay import measure_reliability
from ..strategies.base import StrategyContext
from ..strategies.registry import get_strategy
from ..targets.chat import ChatTarget
from ..findings.engine import build_evidence, build_finding
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
    """Run every objective in a config. `store` is an optional RunStore; `emit` is a progress callback."""
    config.require_full()
    config.require_authorized_target()
    config.require_objectives()

    run_id = run_id or uuid.uuid4().hex
    result = RunResult(run_id=run_id)
    planner = Planner()
    config_snapshot = _config_snapshot(config)

    async with provider_scope():
        attacker_provider = build_provider(config.attacker)  # available to strategies that reason
        target_provider = build_provider(config.target)
        judge_provider = build_provider(config.judge)

        target = ChatTarget(target_provider, system=config.target.system)
        judge = Judge(judge_provider)

        result.calibration = await judge.calibrate()
        if store:
            store.event("calibration", **result.calibration)
        if not result.calibration.get("calibrated", False):
            result.notes.append("judge not calibrated: it flagged a benign fixture; treat findings with care")

        for objective in config.objectives:
            emit(f"objective: {objective.title}")
            finding, records = await _run_objective(
                objective=objective,
                config=config,
                planner=planner,
                target=target,
                attacker_provider=attacker_provider,
                judge=judge,
                run_id=run_id,
                store=store,
                emit=emit,
                config_snapshot=config_snapshot,
            )
            result.objectives_run += 1
            result.attempts.extend(records)
            if finding is not None:
                result.findings.append(finding)

    return result


async def _run_objective(
    *,
    objective: Objective,
    config: Config,
    planner: Planner,
    target: ChatTarget,
    attacker_provider,
    judge: Judge,
    run_id: str,
    store,
    emit,
    config_snapshot: dict,
) -> tuple[Finding | None, list[AttemptRecord]]:
    records: list[AttemptRecord] = []
    sequence = planner.select_sequence(objective, config)
    for strategy_name in sequence:
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

        ctx = StrategyContext(
            objective=objective, target=target, plan_id=plan.id,
            attacker=attacker_provider, judge=judge, emit=emit,
        )
        strat_result = await strategy.run(ctx)

        # Judge each attempt; keep the strongest.
        best = None  # (verdict, run)
        for srun in strat_result.runs:
            verdict = await judge.judge(srun.observation, objective, srun.attempt.payload)
            records.append(AttemptRecord(
                objective=objective.title, strategy=strategy_name,
                prompt_sent=srun.attempt.payload, model_response=srun.observation.response,
                outcome=verdict.outcome.value, score=verdict.score,
            ))
            if store:
                store.event("attempt", objective=objective.title, strategy=strategy_name,
                            payload=srun.attempt.payload, response=srun.observation.response,
                            outcome=verdict.outcome.value, score=verdict.score)
            if best is None or verdict.score > best[0].score:
                best = (verdict, srun)

        if best is None:
            continue
        verdict, srun = best
        if verdict.outcome is not Outcome.SUCCESS:
            emit(f"{strategy_name}: no success (best score {verdict.score}/10), trying next strategy")
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

        candidate_tax: list[TaxonomyRef] = [*strategy.candidate_taxonomy, *objective.candidate_taxonomy]
        target_meta = await target.get_metadata()
        evidence = build_evidence(
            objective=objective, attempt=srun.attempt, observation=srun.observation,
            verdict=verdict, reliability=reliability, target_meta=target_meta,
            config_snapshot=config_snapshot,
        )
        finding = build_finding(
            objective=objective, attempt=srun.attempt, verdict=verdict, reliability=reliability,
            candidate_taxonomy=candidate_tax, run_id=run_id, evidence_id=evidence.id,
        )
        evidence.finding_id = finding.id
        if store:
            store.save_evidence(evidence)
            store.save_finding(finding)
            store.event("finding", id=finding.id, severity=finding.severity.value, title=finding.title)
        emit(f"FINDING: {finding.severity.value} - {finding.title}")
        return finding, records

    return None, records


def _config_snapshot(config: Config) -> dict:
    """A redaction-safe snapshot of the config for evidence (no secrets: only env var names are stored)."""
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
