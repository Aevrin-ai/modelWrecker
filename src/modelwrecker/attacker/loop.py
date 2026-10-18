"""The attack loop: run objectives against a target, judge, verify, and record findings.

This is the orchestrator that ties providers, target, strategies, judge, reliability, evidence, and
findings together (see docs/attack-engine/OVERVIEW.md). It owns provider lifetimes via
provider_scope and refuses unauthorized targets. One objective's strategy sequence lives in
`objective_runner`.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import TYPE_CHECKING

from ..config import Config, Endpoint
from ..data import Finding, Objective
from ..judges.judge import Judge
from ..providers.factory import build_provider, provider_scope
from ..providers.meter import Meter, MeteredProvider
from ..security.egress import EgressPolicy
from ..targets.factory import build_target
from .objective_runner import ObjectiveRun, run_objective
from .planner import Planner
from .run_result import AttemptRecord, RunResult

if TYPE_CHECKING:
    from ..campaigns.budget import Budget
    from ..entitlements import RunAllowance
    from ..storage.store import RunStore

# re-exported: campaigns, the MCP service, and tests import these from here
__all__ = ["AttemptRecord", "RunResult", "run_config"]


def _emit_noop(_m: str) -> None:
    return None


async def run_config(config: Config, *, store: RunStore | None = None,
                     emit: Callable[[str], None] = _emit_noop, run_id: str | None = None,
                     allowance: RunAllowance | None = None) -> RunResult:
    """Run every objective in a config.

    `store` is an optional RunStore; `emit` is a progress callback. `allowance` is the result of
    `entitlements.check_run(config)`; when it is not given it is checked here, before any model
    call, and a run the plan does not allow raises `EntitlementDenied` (a ConfigError).
    """
    allowance = _check_runnable(config, allowance)
    result = RunResult(run_id=run_id or uuid.uuid4().hex)
    result.notes.extend(allowance.notes)
    # counts every model request (all roles and replays), tokens, and estimated cost
    meter = Meter()

    async with provider_scope():
        objective_run = await _prepare_run(config, meter, allowance, result, store, emit)
        await _run_campaign(objective_run, meter)

    return result


def _check_runnable(config: Config, allowance: RunAllowance | None) -> RunAllowance:
    """Refuse an incomplete or unauthorized config, then check the plan before any model call."""
    config.require_full()
    config.require_authorized_target()
    config.require_objectives()

    from ..entitlements import check_run

    return allowance or check_run(config)


async def _prepare_run(config: Config, meter: Meter, allowance: RunAllowance, result: RunResult,
                       store: RunStore | None, emit: Callable[[str], None]) -> ObjectiveRun:
    """Build the three roles, record the run's metadata, and calibrate the judge."""
    attacker_provider, target_provider, judge_provider = _metered_providers(config, meter)
    target = build_target(config.target, target_provider)
    judge = Judge(judge_provider)
    _record_run_meta(config, store, result.run_id)
    await _calibrate_judge(judge, result, store)
    return ObjectiveRun(
        config=config, planner=Planner(), result=result, target=target,
        attacker_provider=attacker_provider, judge=judge, judge_provider=judge_provider,
        run_id=result.run_id, store=store, emit=emit, config_snapshot=_config_snapshot(config),
        budget=_campaign_budget(config, meter, allowance, result), allowance=allowance,
    )


async def _run_campaign(run: ObjectiveRun, meter: Meter) -> None:
    from ..campaigns.engine import execute_campaign
    from ..entitlements import record_run

    async def run_one(objective: Objective) -> tuple[Finding | None, list[AttemptRecord]]:
        return await run_objective(objective, run)

    try:
        await execute_campaign(config=run.config, objectives=run.config.objectives,
                               run_one=run_one, result=run.result, budget=run.budget,
                               emit=run.emit)
    finally:
        record_run(run.budget.attempts)
        _record_usage(meter, run.result, run.store)


def _metered_providers(config: Config,
                       meter: Meter) -> tuple[MeteredProvider, MeteredProvider, MeteredProvider]:
    """The attacker, target, and judge providers, each counted by the meter."""
    # every model call passes the egress guard
    egress = config.security.egress.policy()
    return (
        _metered(config.attacker, "attacker", egress, meter),
        _metered(config.target, "target", egress, meter),
        _metered(config.judge, "judge", egress, meter),
    )


def _metered(endpoint: Endpoint, role: str, egress: EgressPolicy, meter: Meter) -> MeteredProvider:
    # looked up on this module at call time, so tests can replace build_provider
    inner = build_provider(endpoint, egress)
    return MeteredProvider(inner, meter, role,
                           endpoint.price_per_1k_input, endpoint.price_per_1k_output)


def _record_run_meta(config: Config, store: RunStore | None, run_id: str) -> None:
    if not store:
        return
    project_name = (config.project or {}).get("name")
    store.event("run_meta", target_model=config.target.model,
                target_provider=config.target.protocol, run_id=run_id,
                target_type=config.target.type or "chat",
                project_name=str(project_name) if project_name else None)


async def _calibrate_judge(judge: Judge, result: RunResult, store: RunStore | None) -> None:
    result.calibration = await judge.calibrate()
    if store:
        store.event("calibration", **result.calibration)
    if not result.calibration.get("calibrated", False):
        result.notes.append(
            "judge not calibrated: it flagged a benign fixture; treat findings with care"
        )


def _campaign_budget(config: Config, meter: Meter, allowance: RunAllowance,
                     result: RunResult) -> Budget:
    """The campaign budget, capped by the plan's monthly attempt allowance."""
    from ..campaigns.budget import build_budget

    budget = build_budget(config)
    # so the request and cost caps can read running totals
    budget.meter = meter
    remaining = allowance.remaining_attempts
    if remaining is None:
        return budget
    if budget.max_attempts is None or remaining < budget.max_attempts:
        budget.max_attempts = remaining
        result.notes.append(f"plan: {remaining} attack attempts left "
                            "this month; the campaign stops there")
    return budget


def _record_usage(meter: Meter, result: RunResult, store: RunStore | None) -> None:
    result.usage = meter.summary()
    if store:
        store.event("usage", **result.usage)
    if result.usage["cost_usd"]:
        result.notes.append(
            f"usage: {result.usage['requests']} requests, "
            f"estimated cost ${result.usage['cost_usd']:.4f}"
        )


def _config_snapshot(config: Config) -> dict:
    """A redaction-safe snapshot of the config for evidence.

    No secrets: only env var names are stored.
    """
    return {
        "attacker": _endpoint_snapshot(config.attacker),
        "target": _endpoint_snapshot(config.target),
        "judge": _endpoint_snapshot(config.judge),
        "attack": config.attack.model_dump(),
        "engine": config.engine.model_dump(),
    }


def _endpoint_snapshot(endpoint: Endpoint | None) -> dict | None:
    if endpoint is None:
        return None
    return {"protocol": endpoint.protocol, "model": endpoint.model,
            "base_url": endpoint.base_url, "api_key_env": endpoint.api_key_env}
