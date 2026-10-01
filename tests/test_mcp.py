"""MCP harness-integration tests: service guardrails + a real in-memory client round-trip.

The service layer is tested directly (guardrails), and the FastMCP server is driven by a real MCP client
over in-memory streams (tool discovery + a tool call). See docs/features/harness-integration.md.
"""

from __future__ import annotations

import asyncio

import pytest

from modelwrecker.mcp.service import GuardrailError, McpService
from modelwrecker.storage.store import RunStore
from modelwrecker.data import Finding, Severity, TaxonomyRef


# --- service guardrails (offline) ------------------------------------------------------------------


def _write_config(tmp_path, *, authorized: bool) -> str:
    p = tmp_path / "cfg.yaml"
    p.write_text(
        "attacker: {protocol: openai_compatible, model: m, base_url: http://x}\n"
        "target: {protocol: openai_compatible, model: m, base_url: http://x, "
        f"authorized: {str(authorized).lower()}}}\n"
        "judge: {protocol: openai_compatible, model: m, base_url: http://x}\n"
        "objectives: [{title: t, category: system_prompt_leak}]\n",
        encoding="utf-8",
    )
    return str(p)


def test_validate_config_authorized(tmp_path) -> None:
    svc = McpService(runs_dir=tmp_path / "runs")
    assert svc.validate_config(_write_config(tmp_path, authorized=True))["ok"] is True
    bad = svc.validate_config(_write_config(tmp_path, authorized=False))
    assert bad["ok"] is False
    assert any("authorized" in p for p in bad["problems"])


def test_run_rejects_unauthorized_target(tmp_path) -> None:
    svc = McpService(runs_dir=tmp_path / "runs")
    with pytest.raises(GuardrailError):
        asyncio.run(svc.run(_write_config(tmp_path, authorized=False)))


def test_run_dir_traversal_rejected(tmp_path) -> None:
    svc = McpService(runs_dir=tmp_path / "runs")
    for bad in ("../secrets", "..", "a/b", "a\\b", ".hidden", ""):
        with pytest.raises(GuardrailError):
            svc.get_findings(bad)


def test_get_report_reads_only_within_runs(tmp_path) -> None:
    svc = McpService(runs_dir=tmp_path / "runs")
    store = RunStore(run_id="r1", base_dir=str(tmp_path / "runs"))
    store.save_finding(Finding(
        objective_id="o", attempt_id="a", severity=Severity.HIGH, title="demo",
        taxonomy=[TaxonomyRef(framework="owasp_llm", id="LLM07", edition="2025", title="System Prompt Leakage")],
        summary="leaked",
    ))
    report = svc.get_report("r1")
    assert "demo" in report
    assert "LLM07" in report


def test_list_strategies() -> None:
    svc = McpService(runs_dir="runs")
    names = {s["name"] for s in svc.list_strategies()}
    assert {"direct_jailbreak", "prompt_extraction"} <= names


# --- real MCP round-trip over in-memory streams ----------------------------------------------------


def test_mcp_client_server_roundtrip(tmp_path) -> None:
    from mcp.shared.memory import create_connected_server_and_client_session

    from modelwrecker.mcp.server import build_server

    server = build_server(runs_dir=str(tmp_path / "runs"))

    async def scenario() -> None:
        # FastMCP exposes the low-level server as ._mcp_server.
        async with create_connected_server_and_client_session(server._mcp_server) as client:
            await client.initialize()
            tools = await client.list_tools()
            names = {t.name for t in tools.tools}
            assert {"list_strategies", "validate_config", "run", "get_findings",
                    "get_report", "replay"} <= names
            # No host-affecting tool must ever be exposed.
            assert not ({"run_shell", "write_file", "http_request", "read_file"} & names)
            # Call a safe read-only tool for real.
            result = await client.call_tool("list_strategies", {})
            assert result.structuredContent is not None

    asyncio.run(scenario())
