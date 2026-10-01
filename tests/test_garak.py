"""garak adapter tests.

The prompt->attempt mapping is tested offline with a fake target (no garak needed). The live probe
load and registry wiring are gated behind garak being importable, and skip cleanly otherwise.
"""

from __future__ import annotations

import asyncio

import pytest

from modelwrecker.data import Objective
from modelwrecker.providers.fake import FakeProvider
from modelwrecker.strategies.base import StrategyContext
from modelwrecker.strategies.garak_adapter import garak_available
from modelwrecker.strategies.garak_probe import send_prompts
from modelwrecker.targets.chat import ChatTarget


def _ctx() -> StrategyContext:
    target = ChatTarget(FakeProvider("target", lambda m: "I refuse."))
    return StrategyContext(objective=Objective(title="o"), target=target, plan_id="p")


def test_send_prompts_maps_each_prompt_to_an_attempt() -> None:
    prompts = ["attack one", "attack two", "attack three"]
    result = asyncio.run(send_prompts(_ctx(), prompts))
    assert len(result.runs) == 3
    assert [r.attempt.payload for r in result.runs] == prompts
    for r in result.runs:
        assert r.observation.attempt_id == r.attempt.id  # observation linked back to its attempt
        assert r.observation.response == "I refuse."


def test_send_prompts_empty() -> None:
    result = asyncio.run(send_prompts(_ctx(), []))
    assert result.runs == []


@pytest.mark.skipif(not garak_available()[0], reason="garak (scan extra) not installed")
def test_garak_probe_registered_and_loads_prompts() -> None:
    from modelwrecker.strategies.garak_adapter import load_probe_prompts
    from modelwrecker.strategies.registry import list_strategies

    names = {s["name"] for s in list_strategies()}
    assert "garak_probe" in names
    prompts = load_probe_prompts("test.Test", limit=5)
    assert isinstance(prompts, list)
