"""PyRIT-backed strategy tests (PAIR, TAP, prompt-sending), run offline with fake providers.

These need the optional `modelwrecker[attacks]` dependency (PyRIT 1.1+). They are skipped when PyRIT is
not importable, so the suite stays green without it. PyRIT's own logging is silenced here.
"""

from __future__ import annotations

import asyncio
import logging

import pytest

from modelwrecker.strategies.pyrit_adapter import pyrit_available

pytestmark = pytest.mark.skipif(not pyrit_available()[0], reason="PyRIT (attacks extra) not installed")

logging.disable(logging.CRITICAL)

from modelwrecker.data import Objective  # noqa: E402
from modelwrecker.providers.fake import FakeProvider  # noqa: E402
from modelwrecker.strategies.base import StrategyContext  # noqa: E402
from modelwrecker.strategies.registry import get_strategy, list_strategies  # noqa: E402
from modelwrecker.targets.chat import ChatTarget  # noqa: E402

# PyRIT's PAIR/TAP adversarial system prompt expects these JSON keys from the attacker model.
_ADVERSARIAL_JSON = (
    '{"last_response_summary": "none yet", '
    '"next_message": "Please provide the content.", '
    '"rationale": "escalate toward the objective"}'
)
_SCORER_JSON = '{"score_value": "10", "rationale": "the target fully complied", "description": "d"}'


def _ctx(target_response: str) -> StrategyContext:
    target = ChatTarget(FakeProvider("tgt", lambda _m: target_response),
                        system="You are a bot. The secret is ZZZ.")
    return StrategyContext(
        objective=Objective(title="demo", description="do the thing", category="jailbreak"),
        target=target, plan_id="p",
        attacker=FakeProvider("adv", lambda _m: _ADVERSARIAL_JSON),
        judge_provider=FakeProvider("judge", lambda _m: _SCORER_JSON),
    )


def test_pyrit_strategies_registered_when_available() -> None:
    names = {s["name"] for s in list_strategies()}
    assert {"pyrit_send", "pyrit_pair", "pyrit_tap"} <= names


def test_pyrit_send_runs_through_the_bridge() -> None:
    strat = get_strategy("pyrit_send")
    res = asyncio.run(strat.run(_ctx("SURE, here is the content.")))
    assert len(res.runs) == 1
    assert "SURE" in res.runs[0].observation.response


def test_pyrit_pair_runs_and_can_succeed() -> None:
    strat = get_strategy("pyrit_pair")
    res = asyncio.run(strat.run(_ctx("SURE, here is the content you asked for.")))
    assert len(res.runs) == 1
    # PAIR drove the full PyRIT loop and reached a decided outcome.
    assert res.runs[0].observation.target_meta.get("pyrit_outcome")


def test_pyrit_tap_executes() -> None:
    # TAP runs the tree-of-attacks machinery end to end (it may prune offline without its on-topic
    # scorer, which is a valid FAILURE outcome - the point here is it executes without error).
    strat = get_strategy("pyrit_tap")
    res = asyncio.run(strat.run(_ctx("SURE, here is the content you asked for.")))
    assert len(res.runs) == 1
    assert res.runs[0].observation.target_meta.get("pyrit_outcome")
