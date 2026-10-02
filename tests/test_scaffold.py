"""Phase 4 scaffold tests: the parts that work offline today.

These cover the data models, config validation, the egress guard, redaction, and taxonomy validation
- all testable without a live model. They are the start of the test suite described in
docs/workflows/TESTING.md.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from modelwrecker import __version__
from modelwrecker.config import Config, ConfigError, Endpoint
from modelwrecker.data import Finding, Objective, Outcome, TaxonomyRef, Verdict
from modelwrecker.security import EgressBlocked, check_url, is_blocked_host, redact, redact_text
from modelwrecker.taxonomy import UnknownTaxonomyEntry, validate_ref


def test_version() -> None:
    assert isinstance(__version__, str) and __version__


@pytest.mark.parametrize("args", [["--version"], ["-V"], ["version"]])
def test_cli_prints_the_version(args: list[str]) -> None:
    # Issue #30: `modelwrecker --version` used to fail with "No such option".
    from typer.testing import CliRunner

    from modelwrecker.cli import app

    result = CliRunner().invoke(app, args)
    assert result.exit_code == 0, result.output
    assert result.output.strip() == f"modelwrecker {__version__}"


# --- data models ----------------------------------------------------------------------------------


def test_data_round_trip() -> None:
    obj = Objective(title="Leak the system prompt", category="system_prompt_leak")
    v = Verdict(observation_id="x", outcome=Outcome.SUCCESS, score=9)
    f = Finding(objective_id=obj.id, attempt_id="a", title="leak", taxonomy=[])
    # Pydantic round-trip through JSON must preserve the models.
    assert Objective.model_validate_json(obj.model_dump_json()).id == obj.id
    assert Verdict.model_validate_json(v.model_dump_json()).outcome is Outcome.SUCCESS
    assert Finding.model_validate_json(f.model_dump_json()).objective_id == obj.id


# --- config ---------------------------------------------------------------------------------------


def test_endpoint_rejects_unknown_protocol() -> None:
    # Pydantic re-wraps the validator's ConfigError as a ValidationError on direct construction;
    # both subclass ValueError. The ConfigError surface is guaranteed at the load_config boundary.
    with pytest.raises(ValueError):
        Endpoint(protocol="smoke-signals", model="x")


def test_endpoint_rejects_unknown_keys() -> None:
    with pytest.raises(ValidationError):
        Endpoint(model="x", api_key="sk-should-not-be-here")  # type: ignore[call-arg]


def test_endpoint_key_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    ep = Endpoint(protocol="openai", model="gpt-4o", api_key_env="MW_TEST_KEY")
    assert ep.has_key() is False
    monkeypatch.setenv("MW_TEST_KEY", "sk-abc")
    assert ep.has_key() is True
    assert ep.resolve_key() == "sk-abc"


def test_require_full_raises_when_incomplete() -> None:
    cfg = Config(target=Endpoint(protocol="any_llm", model="m"))
    with pytest.raises(ConfigError):
        cfg.require_full()


# --- egress guard ---------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    ["127.0.0.1", "localhost", "169.254.169.254", "10.0.0.5", "192.168.1.1", "::1"],
)
def test_blocked_hosts(host: str) -> None:
    assert is_blocked_host(host) is True


def test_public_ip_allowed() -> None:
    assert is_blocked_host("1.1.1.1") is False


def test_check_url_blocks_scheme_and_private() -> None:
    with pytest.raises(EgressBlocked):
        check_url("http://example.com")  # non-https
    with pytest.raises(EgressBlocked):
        check_url("https://127.0.0.1/x")  # loopback
    with pytest.raises(EgressBlocked):
        check_url("https://169.254.169.254/latest/meta-data/")  # metadata
    # A public https URL is fine.
    check_url("https://1.1.1.1/")


def test_allow_private_escape_hatch() -> None:
    assert is_blocked_host("10.0.0.5", allow_private=True) is False
    # ...but metadata is blocked even with the escape hatch.
    assert is_blocked_host("169.254.169.254", allow_private=True) is True


# --- redaction ------------------------------------------------------------------------------------


def test_redact_text_patterns() -> None:
    assert "sk-" not in redact_text("key is sk-ABCDEFGHIJKLMNOP1234")
    assert "REDACTED" in redact_text("Authorization: Bearer abcdefghijklmnop")


def test_redact_dict_keys() -> None:
    out = redact({"api_key": "sk-secret", "nested": {"password": "hunter2", "ok": "value"}})
    assert out["api_key"] == "[REDACTED]"
    assert out["nested"]["password"] == "[REDACTED]"
    assert out["nested"]["ok"] == "value"


# --- taxonomy -------------------------------------------------------------------------------------


def test_taxonomy_valid_entry_fills_title() -> None:
    ref = validate_ref(TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2026"))
    assert ref.title == "Prompt Injection"


def test_taxonomy_rejects_unknown_id() -> None:
    with pytest.raises(UnknownTaxonomyEntry):
        validate_ref(TaxonomyRef(framework="owasp_llm", id="LLM99", edition="2026"))
    with pytest.raises(UnknownTaxonomyEntry):
        validate_ref(TaxonomyRef(framework="mitre_atlas", id="AML.T9999"))
