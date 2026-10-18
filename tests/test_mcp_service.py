"""MCP service: the happy path, target scope, and tool permission.

Each denial test also asserts the engine was never called, so a denied request can never
partially run an attack. See docs/security/mcp.md.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest
from mcp_fakes import denied, service_for, spy_on_engine, write_config

from modelwrecker.config import Config
from modelwrecker.data import Finding, Severity, TaxonomyRef
from modelwrecker.mcp.guardrails import McpLimits
from modelwrecker.storage.store import RunStore


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> list[Config]:
    """Replace the shared engine with a spy. Records every config it is handed."""
    return spy_on_engine(monkeypatch)


def test_run_happy_path_reaches_engine_with_bounded_config(tmp_path, engine) -> None:
    svc = service_for(tmp_path)
    write_config(tmp_path)
    out = asyncio.run(svc.call("run", {"config_path": "cfg.yaml", "run_id": "r-ok"}))
    assert out["run_id"] == "r-ok"
    assert out["objectives_run"] == 1
    assert len(engine) == 1
    # Caps the config left open are filled in, so an MCP run is always bounded.
    budget = engine[0].campaign.budget
    assert budget.max_attempts == McpLimits().max_attempts
    assert budget.max_seconds == McpLimits().max_seconds
    # The run slot is released afterwards, so a second run is admitted.
    asyncio.run(svc.call("run", {"config_path": "cfg.yaml"}))
    assert len(engine) == 2


def test_validate_config_authorized(tmp_path) -> None:
    svc = service_for(tmp_path)
    assert svc.validate_config(write_config(tmp_path, authorized=True))["ok"] is True
    bad = svc.validate_config(write_config(tmp_path, authorized=False, name="bad.yaml"))
    assert bad["ok"] is False
    assert any("authorized" in p for p in bad["problems"])


def test_validate_config_runs_the_same_egress_check_as_the_cli(tmp_path) -> None:
    svc = service_for(tmp_path)
    text = Path(write_config(tmp_path)).read_text(encoding="utf-8")
    blocked = tmp_path / "blocked.yaml"
    blocked.write_text(text.replace("base_url: https://x, ", "base_url: http://127.0.0.1, "),
                       encoding="utf-8")
    out = svc.validate_config(str(blocked))
    assert out["ok"] is False
    assert any("egress blocked" in p and "target.base_url" in p for p in out["problems"])


def test_get_report_reads_only_within_runs(tmp_path) -> None:
    svc = service_for(tmp_path)
    store = RunStore(run_id="r1", base_dir=str(tmp_path / "runs"))
    store.save_finding(Finding(
        objective_id="o", attempt_id="a", severity=Severity.HIGH, title="demo",
        taxonomy=[TaxonomyRef(framework="owasp_llm", id="LLM07", edition="2025",
                              title="System Prompt Leakage")],
        summary="leaked",
    ))
    report = svc.get_report("r1")
    assert "demo" in report
    assert "LLM07" in report
    assert svc.get_findings("r1")[0]["title"] == "demo"


def test_list_strategies(tmp_path) -> None:
    names = {s["name"] for s in service_for(tmp_path).list_strategies()}
    assert {"direct_jailbreak", "prompt_extraction"} <= names


def test_run_rejects_unauthorized_target(tmp_path, engine) -> None:
    svc = service_for(tmp_path)
    err = denied("target_not_authorized", svc.run, write_config(tmp_path, authorized=False),
                 run_id="r-unauth")
    assert err.check == "target_scope"
    assert engine == []
    assert not (tmp_path / "runs" / "r-unauth").exists()  # nothing was started or written


def test_run_rejects_unknown_target(tmp_path, engine) -> None:
    svc = service_for(tmp_path)
    err = denied("unknown_target", svc.run, write_config(tmp_path, target=False))
    assert err.check == "target_scope"
    assert engine == []


@pytest.mark.parametrize("override", [
    {"base_url": "http://169.254.169.254/latest"},
    {"target": {"base_url": "https://evil.example", "authorized": True}},
    {"endpoint": "https://evil.example/v1"},
    {"authorized": True},
])
def test_run_rejects_endpoint_override(tmp_path, engine, override) -> None:
    svc = service_for(tmp_path)
    write_config(tmp_path, authorized=False)
    args = {"config_path": "cfg.yaml", **override}
    err = denied("unexpected_argument", svc.call, "run", args)
    assert err.check == "tool_permission"
    assert engine == []


@pytest.mark.parametrize(
    "tool", ["run_shell", "http_request", "read_file", "write_file", "", "RUN"]
)
def test_unknown_tool_rejected(tmp_path, engine, tool) -> None:
    err = denied("unknown_tool", service_for(tmp_path).call, tool, {})
    assert err.check == "tool_permission"
    assert engine == []


def test_missing_required_argument_rejected(tmp_path, engine) -> None:
    denied("missing_argument", service_for(tmp_path).call, "run", {})
    assert engine == []
