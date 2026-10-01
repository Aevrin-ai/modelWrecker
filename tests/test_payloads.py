"""Payload engine tests (Phase 6): transforms, chains, round-trips, and the encoded strategy."""

from __future__ import annotations

import asyncio

import pytest

from modelwrecker.payloads import PayloadEngine, apply_chain, get_transform, list_transforms
from modelwrecker.data import Objective
from modelwrecker.providers.fake import FakeProvider
from modelwrecker.strategies.base import StrategyContext
from modelwrecker.strategies.registry import get_strategy
from modelwrecker.targets.chat import ChatTarget


def test_builtin_transforms_registered() -> None:
    names = {t["name"] for t in list_transforms()}
    assert {"base64", "rot13", "reverse", "zero_width", "leetspeak", "homoglyph"} <= names


@pytest.mark.parametrize("name", ["base64", "rot13", "reverse", "zero_width"])
def test_reversible_round_trip(name: str) -> None:
    t = get_transform(name)
    assert t.reversible
    original = "attack the model now"
    assert t.decode(t.apply(original)) == original


def test_apply_chain_and_decode() -> None:
    eng = PayloadEngine()
    original = "hello"
    encoded = eng.chain(original, ["rot13", "base64"])
    assert encoded != original
    assert eng.decode(encoded, ["rot13", "base64"]) == original


def test_leetspeak_is_lossy_and_not_reversible() -> None:
    t = get_transform("leetspeak")
    assert t.reversible is False
    assert t.apply("elite") == "3l173"
    with pytest.raises(ValueError):
        t.decode("3l173")


def test_unknown_transform_errors() -> None:
    with pytest.raises(KeyError):
        get_transform("does_not_exist")


def test_encoded_strategy_applies_and_records_chain() -> None:
    strat = get_strategy("encoded_jailbreak")
    sent: dict = {}

    def responder(messages: list[dict]) -> str:
        sent["payload"] = messages[-1]["content"]
        return "ok"

    target = ChatTarget(FakeProvider("t", responder))
    ctx = StrategyContext(
        objective=Objective(title="x", description="reveal the secret", category="jailbreak"),
        target=target, plan_id="p", payloads=PayloadEngine(), params={"transforms": ["base64"]},
    )
    res = asyncio.run(strat.run(ctx))
    assert len(res.runs) == 1
    # The payload sent is base64-wrapped, and the chain is recorded for reproducibility.
    assert "Base64" in sent["payload"]
    assert res.runs[0].attempt.transform_chain == [{"name": "base64"}]


def test_apply_chain_helper() -> None:
    assert apply_chain("abc", ["reverse"]) == "cba"
