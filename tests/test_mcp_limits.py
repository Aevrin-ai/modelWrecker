"""MCP resource and rate limits.

The oversized-campaign tests are calibrated: values exactly at each limit must pass, so a
check that simply refuses everything fails the suite.

Each denial test also asserts the engine was never called, so a denied request can never
partially run an attack. See docs/security/mcp.md.
"""

from __future__ import annotations

import asyncio

import pytest
from mcp_fakes import FakeClock, denied, service_for, spy_on_engine, write_config

from modelwrecker.config import Config
from modelwrecker.mcp.guardrails import GuardrailError, McpLimits, RateLimiter
from modelwrecker.storage.store import RunStore


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> list[Config]:
    """Replace the shared engine with a spy. Records every config it is handed."""
    return spy_on_engine(monkeypatch)


_OVERSIZED = [
    ("objectives", {"objectives": 11}),
    ("concurrency", {"extra": "campaign: {concurrency: 5}\n"}),
    ("retries", {"extra": "campaign: {retries: 4}\n"}),
    ("attempts", {"extra": "campaign: {budget: {max_attempts: 201}}\n"}),
    ("seconds", {"extra": "campaign: {budget: {max_seconds: 1801}}\n"}),
    ("deadline", {"extra": "engine: {deadline_seconds: 99999}\n"}),
    ("replays", {"extra": "engine: {replays: 17}\n"}),
    ("param", {"extra": "attack: {strategy: best_of_n, params: {n: 51}}\n"}),
]


@pytest.mark.parametrize("label,kw", _OVERSIZED, ids=[o[0] for o in _OVERSIZED])
def test_oversized_campaign_rejected(tmp_path, engine, label, kw) -> None:
    err = denied("campaign_too_large", service_for(tmp_path).run, write_config(tmp_path, **kw))
    assert err.check == "resource_limit"
    assert engine == []


def test_campaign_exactly_at_limits_is_allowed(tmp_path, engine) -> None:
    extra = (
        "campaign: {concurrency: 4, retries: 3, budget: {max_attempts: 200, max_seconds: 1800}}\n"
        "engine: {replays: 16}\n"
        "attack: {strategy: best_of_n, params: {n: 50}}\n"
    )
    asyncio.run(service_for(tmp_path).run(write_config(tmp_path, objectives=10, extra=extra)))
    assert len(engine) == 1


def test_objective_budget_brings_large_config_within_limit(tmp_path, engine) -> None:
    extra = "campaign: {budget: {max_objectives: 10}}\n"
    asyncio.run(service_for(tmp_path).run(write_config(tmp_path, objectives=30, extra=extra)))
    assert len(engine) == 1


def test_call_rate_limit(tmp_path) -> None:
    clock = FakeClock()
    svc = service_for(tmp_path, limits=McpLimits(calls_per_minute=3), clock=clock)
    for _ in range(3):
        asyncio.run(svc.call("list_strategies", {}))
    err = denied("rate_limited", svc.call, "list_strategies", {})
    assert err.check == "rate_limit"
    clock.t += 61  # the window slides; calls are admitted again
    asyncio.run(svc.call("list_strategies", {}))


def test_run_rate_limit(tmp_path, engine) -> None:
    clock = FakeClock()
    svc = service_for(tmp_path, limits=McpLimits(runs_per_hour=1), clock=clock)
    cfg = write_config(tmp_path)
    asyncio.run(svc.run(cfg))
    denied("run_rate_limited", svc.run, cfg)
    assert len(engine) == 1
    clock.t += 3601
    asyncio.run(svc.run(cfg))
    assert len(engine) == 2


def test_denied_run_does_not_use_a_run_slot(tmp_path, engine) -> None:
    svc = service_for(tmp_path, limits=McpLimits(runs_per_hour=1))
    denied("target_not_authorized", svc.run,
           write_config(tmp_path, authorized=False, name="no.yaml"))
    asyncio.run(svc.run(write_config(tmp_path)))  # the one allowed run is still available
    assert len(engine) == 1


def test_only_one_active_run(tmp_path, monkeypatch) -> None:
    from modelwrecker.attacker import loop

    gate = asyncio.Event()
    started = asyncio.Event()

    async def slow_run_config(cfg: Config, *, store: RunStore | None = None,
                              emit: object = None, run_id: str | None = None) -> loop.RunResult:
        started.set()
        await gate.wait()
        return loop.RunResult(run_id=run_id)

    monkeypatch.setattr(loop, "run_config", slow_run_config)
    svc = service_for(tmp_path)
    cfg = write_config(tmp_path)

    async def scenario() -> None:
        first = asyncio.create_task(svc.run(cfg))
        await started.wait()
        with pytest.raises(GuardrailError) as ei:
            await svc.run(cfg)
        assert ei.value.code == "run_in_progress"
        gate.set()
        await first
        await svc.run(cfg)  # slot released after the first run finished

    asyncio.run(scenario())


def test_rate_limiter_window() -> None:
    clock = FakeClock()
    rl = RateLimiter(2, 10.0, clock)
    assert rl.try_acquire() and rl.try_acquire()
    assert not rl.try_acquire()
    clock.t += 10
    assert rl.try_acquire()
