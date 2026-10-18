"""Turn a candidate success into a finding: replay it, and record evidence only if it holds.

A success is not a finding until it is verified: a one-shot success can be luck
(docs/attack-engine/RELIABILITY.md).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..data import AttackPlan, Finding, Objective, ReliabilityResult, TaxonomyRef, Verdict
from ..findings.engine import build_evidence, build_finding
from ..reliability.replay import measure_reliability
from ..strategies.base import BaseStrategy, StrategyRun

if TYPE_CHECKING:
    from .attempt_judging import JudgedRuns
    from .objective_runner import ObjectiveRun


async def verify_and_record(strategy: BaseStrategy, strategy_name: str, plan: AttackPlan,
                            judged: JudgedRuns, objective: Objective,
                            run: ObjectiveRun) -> Finding | None:
    """Replay the best attack run; record and return a finding only when the success holds."""
    verdict, strategy_run = judged.best_verdict, judged.best_run
    run.emit(f"{strategy_name}: success (score {verdict.score}/10); verifying with replay")
    reliability = await measure_reliability(
        target=run.target, judge=run.judge, objective=objective,
        payload=strategy_run.attempt.payload, attempt_id=strategy_run.attempt.id,
        n=run.config.engine.replays, threshold=run.config.engine.reliable_threshold,
        backend_pinned=bool(run.config.target.provider_pin),
        replay=strategy_run.replay,
    )
    if run.store:
        run.store.event("reliability", strategy=strategy_name,
                        rate=reliability.success_rate, confidence=reliability.confidence.value)

    if reliability.confidence.value == "does_not_hold":
        run.emit(f"{strategy_name}: did not hold on replay; not a finding")
        return None
    return await _record_finding(strategy, strategy_name, plan, verdict, strategy_run,
                                 reliability, objective, run)


async def _record_finding(strategy: BaseStrategy, strategy_name: str, plan: AttackPlan,
                          verdict: Verdict, strategy_run: StrategyRun,
                          reliability: ReliabilityResult, objective: Objective,
                          run: ObjectiveRun) -> Finding:
    candidate_tax: list[TaxonomyRef] = [
        *strategy.candidate_taxonomy, *objective.candidate_taxonomy
    ]
    target_meta = await run.target.get_metadata()
    evidence = build_evidence(
        objective=objective, attempt=strategy_run.attempt, observation=strategy_run.observation,
        verdict=verdict, reliability=reliability, target_meta=target_meta,
        config_snapshot=run.config_snapshot, strategy=strategy_name,
        strategy_params=dict(plan.strategy_params),
    )
    finding = build_finding(
        objective=objective, attempt=strategy_run.attempt, verdict=verdict,
        reliability=reliability, candidate_taxonomy=candidate_tax, run_id=run.run_id,
        evidence_id=evidence.id,
    )
    evidence.finding_id = finding.id
    if run.store:
        run.store.save_evidence(evidence)
        run.store.save_finding(finding)
        run.store.event("finding", id=finding.id, severity=finding.severity.value,
                        title=finding.title, strategy=strategy_name)
    run.emit(f"FINDING: {finding.severity.value} - {finding.title}")
    return finding
