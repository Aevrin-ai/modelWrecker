"""Payload engine tests (Phase 6): transforms, chains, round-trips, and the encoded strategy."""

from __future__ import annotations

import asyncio

import pytest

from modelwrecker.data import Objective
from modelwrecker.payloads import PayloadEngine, apply_chain, get_transform, list_transforms
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


def test_payload_registry_loads_without_pyrit(monkeypatch) -> None:
    """Regression: without the attacks extra, the payload registry must load with built-ins only.

    Found by the Docker build (default image has no PyRIT): the registry imported PyRIT
    unguarded and every run failed with "No module named 'pyrit'".
    """
    import importlib
    import sys

    from modelwrecker.payloads import pyrit_converters, registry

    with monkeypatch.context() as m:
        # A None entry in sys.modules makes `import pyrit` raise ImportError, as if not installed.
        for mod in [k for k in sys.modules if k == "pyrit" or k.startswith("pyrit.")]:
            m.delitem(sys.modules, mod)
        m.setitem(sys.modules, "pyrit", None)
        m.setitem(sys.modules, "pyrit.converter", None)
        assert pyrit_converters.pyrit_transforms() == []
        reloaded = importlib.reload(registry)
        names = {t["name"] for t in reloaded.list_transforms()}
        assert {"base64", "rot13", "reverse"} <= names
        assert not any(n.startswith("pyrit_") for n in names)
    importlib.reload(registry)  # restore the normal registry for later tests
