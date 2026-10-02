"""Unit tests for individual engine components (offline)."""

from __future__ import annotations

import asyncio

import pytest

from modelwrecker.config import Endpoint
from modelwrecker.data import Confidence, Severity, TaxonomyRef
from modelwrecker.findings.engine import _severity, resolve_taxonomy
from modelwrecker.providers.base import ProviderError
from modelwrecker.providers.factory import build_provider
from modelwrecker.providers.openai_compatible import _parse_chat_completion
from modelwrecker.strategies.registry import get_strategy, list_strategies


def test_parse_chat_completion() -> None:
    data = {
        "model": "m",
        "choices": [{"message": {"content": "hello", "reasoning": "because"}}],
        "usage": {"prompt_tokens": 3, "completion_tokens": 2, "total_tokens": 5},
    }
    c = _parse_chat_completion(data, latency_ms=12, model="m")
    assert c.text == "hello"
    assert c.reasoning == "because"
    assert c.usage.total_tokens == 5
    assert c.latency_ms == 12


def test_factory_anthropic_not_implemented() -> None:
    with pytest.raises(ProviderError):
        build_provider(Endpoint(protocol="anthropic", model="claude-x"))


def test_factory_builds_openai_wire() -> None:
    p = build_provider(Endpoint(protocol="openai_compatible", model="m", base_url="http://x/v1"))
    assert p.model == "m"


def test_strategy_registry() -> None:
    names = {s["name"] for s in list_strategies()}
    assert {"direct_jailbreak", "prompt_extraction"} <= names
    with pytest.raises(KeyError):
        get_strategy("does_not_exist")


def test_severity_scaling() -> None:
    assert _severity(9, Confidence.RELIABLE) is Severity.CRITICAL
    assert _severity(7, Confidence.RELIABLE) is Severity.HIGH
    assert _severity(9, Confidence.FLAKY) is Severity.MEDIUM
    assert _severity(9, Confidence.DOES_NOT_HOLD) is Severity.INFO


def test_resolve_taxonomy_drops_unknown() -> None:
    refs = [
        TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2026"),
        TaxonomyRef(framework="owasp_llm", id="LLM99", edition="2026"),  # invalid -> dropped
    ]
    out = resolve_taxonomy(refs)
    assert len(out) == 1
    assert out[0].title == "Prompt Injection"


def test_judge_calibration_offline() -> None:
    from modelwrecker.judges.judge import Judge
    from modelwrecker.providers.fake import FakeProvider

    # A judge that always refuses benign fixtures is well-calibrated.
    judge = Judge(FakeProvider("judge", lambda _m: '{"refused":1,"score":0,"rationale":"refused"}'))
    report = asyncio.run(judge.calibrate())
    assert report["calibrated"] is True
    assert report["false_positives"] == 0
