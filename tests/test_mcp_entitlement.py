"""MCP entitlement hook (fail safe) and the shape and logging of a denial.

Each denial test also asserts the engine was never called, so a denied request can never
partially run an attack. See docs/security/mcp.md.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping

import pytest
from mcp_fakes import denied, service_for, spy_on_engine, write_config

from modelwrecker.config import Config
from modelwrecker.mcp.guardrails import EntitlementDecision, GuardrailError


@pytest.fixture
def engine(monkeypatch: pytest.MonkeyPatch) -> list[Config]:
    """Replace the shared engine with a spy. Records every config it is handed."""
    return spy_on_engine(monkeypatch)


class _DenyAll:
    def __init__(self) -> None:
        self.asked: list[tuple[str, dict]] = []

    def check(self, operation: str, context: Mapping[str, object]) -> object:
        self.asked.append((operation, dict(context)))
        return EntitlementDecision(False, "plan does not include MCP runs")


class _Broken:
    def check(self, operation: str, context: Mapping[str, object]) -> object:
        raise RuntimeError("cannot verify signature")


class _NoAnswer:
    def check(self, operation: str, context: Mapping[str, object]) -> object:
        return True  # not an EntitlementDecision: must not count as allowed


@pytest.mark.parametrize("checker", [_DenyAll(), _Broken(), _NoAnswer()],
                         ids=["deny", "error", "malformed"])
def test_entitlement_denies_fail_safe(tmp_path, engine, checker) -> None:
    svc = service_for(tmp_path, entitlements=checker)
    err = denied("not_entitled", svc.run, write_config(tmp_path))
    assert err.check == "entitlement"
    assert engine == []


def test_entitlement_is_asked_with_operation_context(tmp_path, engine) -> None:
    checker = _DenyAll()
    with pytest.raises(GuardrailError):
        asyncio.run(service_for(tmp_path, entitlements=checker).run(write_config(tmp_path)))
    assert checker.asked == [("run", {"target_type": "chat", "strategy": "auto", "objectives": 1})]


def test_denial_is_structured_and_logged_redacted(tmp_path, engine, caplog) -> None:
    # built from parts so the source never holds a literal that looks like a real key
    secret = "sk-" + "abcdefghijklmnopqrstuvwxyz0123"
    svc = service_for(tmp_path)
    write_config(tmp_path)
    with caplog.at_level(logging.WARNING, logger="modelwrecker.mcp"):
        err = denied("unexpected_argument", svc.call, "run",
                     {"config_path": "cfg.yaml", "api_key": secret, "note": f"Bearer {secret}"})
    assert err.to_dict() == {"denied": True, "check": "tool_permission",
                             "code": "unexpected_argument", "message": err.message}
    assert "unexpected_argument" in str(err)
    logged = caplog.text
    assert "mcp denied" in logged and "unexpected_argument" in logged
    assert secret not in logged
    assert "[REDACTED]" in logged
    assert engine == []
