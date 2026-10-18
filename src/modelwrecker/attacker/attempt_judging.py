"""Judge every attempt of one strategy and decide whether its best attack run is a candidate.

A benign control attempt that also "succeeds" is a false positive: the target misbehaves even
without the injection, so the matching attack success never becomes a finding.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from ..data import Objective, Outcome, Verdict
from ..strategies.base import StrategyResult, StrategyRun
from .run_result import AttemptRecord

if TYPE_CHECKING:
    from .objective_runner import ObjectiveRun


@dataclass
class JudgedRuns:
    """One strategy's runs after judging: the strongest attack run and the control results."""
    best_verdict: Verdict | None = None
    best_run: StrategyRun | None = None
    attempts: int = 0
    confirmed: int = 0
    control_failures: int = 0
    control_success_by_scenario: dict[str, bool] = field(default_factory=dict)


async def judge_runs(strategy_result: StrategyResult, strategy_name: str, objective: Objective,
                     run: ObjectiveRun, records: list[AttemptRecord]) -> JudgedRuns:
    """Judge each attempt, record it in the transcript, and keep the strongest attack run."""
    judged = JudgedRuns()
    for strategy_run in strategy_result.runs:
        verdict = await run.judge.judge(strategy_run.observation, objective,
                                        strategy_run.attempt.payload)
        judged.attempts += 1
        _record_attempt(strategy_run, verdict, strategy_name, objective, run, records)
        _tally(judged, strategy_run, verdict)
    return judged


def _record_attempt(strategy_run: StrategyRun, verdict: Verdict, strategy_name: str,
                    objective: Objective, run: ObjectiveRun, records: list[AttemptRecord]) -> None:
    records.append(AttemptRecord(
        objective=objective.title, strategy=strategy_name,
        prompt_sent=strategy_run.attempt.payload,
        model_response=strategy_run.observation.response,
        outcome=verdict.outcome.value, score=verdict.score,
        objective_category=objective.category, control=strategy_run.control,
    ))
    if run.store:
        run.store.event("attempt", objective=objective.title, strategy=strategy_name,
                        payload=strategy_run.attempt.payload,
                        response=strategy_run.observation.response,
                        outcome=verdict.outcome.value, score=verdict.score,
                        category=objective.category, control=strategy_run.control)


def _tally(judged: JudgedRuns, strategy_run: StrategyRun, verdict: Verdict) -> None:
    succeeded = verdict.outcome is Outcome.SUCCESS
    if strategy_run.control:
        if succeeded:
            judged.control_failures += 1
            judged.control_success_by_scenario[scenario_of(strategy_run)] = True
        return
    if succeeded:
        judged.confirmed += 1
    if judged.best_verdict is None or verdict.score > judged.best_verdict.score:
        judged.best_verdict = verdict
        judged.best_run = strategy_run


def scenario_of(strategy_run: StrategyRun) -> str:
    """The target scenario an attempt ran in, so an attack is compared with its own control."""
    return str((strategy_run.observation.target_meta or {}).get("scenario") or "")


def record_strategy_metrics(judged: JudgedRuns, strategy_name: str, objective: Objective,
                            run: ObjectiveRun) -> None:
    metrics = {"strategy": strategy_name, "attempts": judged.attempts,
               "confirmed": judged.confirmed,
               "benign_control_failures": judged.control_failures}
    run.result.strategy_metrics.append(metrics)
    if run.store:
        run.store.event("strategy_metrics", objective=objective.title, **metrics)


def is_finding_candidate(judged: JudgedRuns, strategy_name: str, run: ObjectiveRun) -> bool:
    """True when the best attack run succeeded and its matching benign control did not."""
    if judged.best_verdict is None or judged.best_run is None:
        return False
    best_scenario = scenario_of(judged.best_run)
    if judged.control_success_by_scenario.get(best_scenario):
        run.emit(f"{strategy_name}: benign control also succeeded"
                 f"{f' for {best_scenario}' if best_scenario else ''}; "
                 "treating as a false positive, not a finding")
        return False
    if judged.best_verdict.outcome is not Outcome.SUCCESS:
        run.emit(f"{strategy_name}: no success (best score {judged.best_verdict.score}/10), "
                 "trying next strategy")
        return False
    return True
