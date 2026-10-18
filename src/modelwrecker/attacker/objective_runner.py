"""One objective through its planned strategies, stopping at the first verified finding."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from ..config import Config
from ..data import AttackPlan, Finding, Objective, Observation
from ..judges.judge import Judge
from ..strategies.base import BaseStrategy, StrategyContext, StrategyResult
from ..strategies.registry import get_strategy
from .attempt_judging import is_finding_candidate, judge_runs, record_strategy_metrics
from .finding_recorder import verify_and_record
from .planner import Planner
from .run_result import AttemptRecord, RunResult

if TYPE_CHECKING:
    from ..campaigns.budget import Budget
    from ..entitlements import RunAllowance
    from ..interfaces import Target
    from ..providers.base import BaseProvider
    from ..storage.store import RunStore


@dataclass
class ObjectiveRun:
    """What every objective in a run shares: the three roles, the store, the budget, the plan."""
    config: Config
    planner: Planner
    result: RunResult
    target: Target
    attacker_provider: BaseProvider
    judge: Judge
    judge_provider: BaseProvider
    run_id: str
    store: RunStore | None
    emit: Callable[[str], None]
    config_snapshot: dict
    budget: Budget | None = None
    allowance: RunAllowance | None = None


async def run_objective(objective: Objective,
                        run: ObjectiveRun) -> tuple[Finding | None, list[AttemptRecord]]:
    """Try each planned strategy in order; return the first verified finding and the transcript."""
    records: list[AttemptRecord] = []
    for strategy_name in run.planner.select_sequence(objective, run.config):
        if _budget_exhausted(objective, strategy_name, run):
            break
        strategy = _usable_strategy(objective, strategy_name, run)
        if strategy is None:
            continue
        plan, strategy_result = await _run_strategy(strategy, strategy_name, objective, run)
        judged = await judge_runs(strategy_result, strategy_name, objective, run, records)
        record_strategy_metrics(judged, strategy_name, objective, run)
        if not is_finding_candidate(judged, strategy_name, run):
            continue
        finding = await verify_and_record(strategy, strategy_name, plan, judged, objective, run)
        if finding is not None:
            return finding, records
    return None, records


def _budget_exhausted(objective: Objective, strategy_name: str, run: ObjectiveRun) -> bool:
    """Budgets are checked before each strategy, so a running objective stops cleanly."""
    if run.budget is None:
        return False
    exhausted, why = run.budget.exhausted()
    if exhausted:
        run.emit(f"{objective.title}: stopping before {strategy_name} ({why})")
    return exhausted


def _usable_strategy(objective: Objective, strategy_name: str,
                     run: ObjectiveRun) -> BaseStrategy | None:
    """The strategy, or None when the plan leaves it out or the target cannot support it."""
    if run.allowance is not None and not run.allowance.strategy_allowed(strategy_name):
        run.emit(f"skip {strategy_name}: not included in your plan (needs Pro)")
        return None
    strategy = get_strategy(strategy_name)
    # reported as NOT TESTED, never silently skipped, so a clean run does not look like a passed one
    missing = strategy.required_target_capabilities - run.target.capabilities()
    if not missing:
        return strategy
    reason = "target lacks " + ", ".join(sorted(capability.value for capability in missing))
    run.emit(f"not tested: {strategy_name} ({reason})")
    run.result.not_tested.append({"strategy": strategy_name, "reason": reason})
    if run.store:
        run.store.event("not_tested", strategy=strategy_name, reason=reason,
                        objective=objective.title)
    return None


async def _run_strategy(strategy: BaseStrategy, strategy_name: str, objective: Objective,
                        run: ObjectiveRun) -> tuple[AttackPlan, StrategyResult]:
    from ..payloads import PayloadEngine

    plan = AttackPlan(
        objective_id=objective.id,
        strategy=strategy_name,
        rationale=run.planner.rationale(objective, run.config, strategy_name),
    )
    if run.store:
        run.store.event("attack_plan", objective=objective.title, strategy=strategy_name,
                        rationale=plan.rationale)
    ctx = StrategyContext(
        objective=objective, target=run.target, plan_id=plan.id,
        attacker=run.attacker_provider, judge=run.judge, judge_provider=run.judge_provider,
        params=dict(run.config.attack.params), payloads=PayloadEngine(), emit=run.emit,
    )
    strategy_result = await strategy.run(ctx)
    if run.budget is not None:
        run.budget.record(
            attempts=len(strategy_result.runs),
            tokens=sum(_observation_tokens(item.observation) for item in strategy_result.runs),
        )
    return plan, strategy_result


def _observation_tokens(observation: Observation) -> int:
    """Target tokens (prompt + completion) reported for one observation, for budget accounting."""
    meta = observation.target_meta or {}
    return int(meta.get("prompt_tokens") or 0) + int(meta.get("completion_tokens") or 0)
