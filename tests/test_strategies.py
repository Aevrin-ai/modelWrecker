"""Tests for the Phase 5 strategies, run offline against a fake-provider chat target."""

from __future__ import annotations

import asyncio

from modelwrecker.data import Objective
from modelwrecker.providers.fake import FakeProvider
from modelwrecker.strategies.base import StrategyContext
from modelwrecker.strategies.registry import get_strategy, list_strategies
from modelwrecker.targets.chat import ChatTarget


def _ctx(responder=None):
    target = ChatTarget(FakeProvider("t", responder or (lambda _m: "ok reply")))
    obj = Objective(title="Do the thing", description="Please do the thing.", category="jailbreak")
    return StrategyContext(objective=obj, target=target, plan_id="p1"), target


def _run(strategy_name, responder=None):
    strat = get_strategy(strategy_name)
    ctx, target = _ctx(responder)
    result = asyncio.run(strat.run(ctx))
    return result, target


def test_all_phase5_strategies_registered() -> None:
    names = {s["name"] for s in list_strategies()}
    assert {"best_of_n", "prefill", "many_shot", "crescendo"} <= names


def test_best_of_n_samples_three() -> None:
    result, target = _run("best_of_n")
    assert len(result.runs) == 3
    assert all(r.observation.response for r in result.runs)
    assert len(target._provider.calls) == 3


def test_prefill_sends_assistant_prefix() -> None:
    result, target = _run("prefill")
    assert len(result.runs) == 1
    # The last message in the sent thread must be an assistant prefill.
    sent = target._provider.calls[0]
    assert sent[-1]["role"] == "assistant"


def test_many_shot_builds_multi_turn_thread() -> None:
    result, target = _run("many_shot")
    assert len(result.runs) == 1
    sent = target._provider.calls[0]
    # Several faux turns plus the real ask => more than 2 messages.
    assert len(sent) > 2
    assert sent[-1]["role"] == "user"


def test_crescendo_escalates_three_turns() -> None:
    result, target = _run("crescendo")
    assert len(result.runs) == 3
    # The final send should carry the whole escalating thread (prior user+assistant turns).
    last_sent = target._provider.calls[-1]
    assert len(last_sent) >= 5  # 3 user + 2 carried assistant replies


def test_pyrit_adapter_reports_availability_honestly() -> None:
    from modelwrecker.strategies.pyrit_adapter import pyrit_available

    ok, detail = pyrit_available()
    assert isinstance(ok, bool)
    assert isinstance(detail, str) and detail
