"""MCP harness-integration tests: the guardrail chain, the service, and the real server.

Every denial path is tested (unknown tool, endpoint override, unknown or unauthorized target, path
traversal, oversized campaign, rate limits, entitlement) along with the happy path. Each denial test
also asserts the engine was never called, so a denied request can never partially run an attack.
The oversized-campaign tests are calibrated: values exactly at each limit must pass, so a check that
simply refuses everything fails the suite. See docs/security/mcp.md.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import pytest

from modelwrecker.data import Finding, Severity, TaxonomyRef
from modelwrecker.mcp.guardrails import (
    TOOL_ARGUMENTS,
    EntitlementDecision,
    GuardrailError,
    McpLimits,
    RateLimiter,
)
from modelwrecker.mcp.service import McpService
from modelwrecker.storage.store import RunStore

# --- helpers --------------------------------------------------------------------------------------

_ENDPOINTS = (
    "attacker: {protocol: openai_compatible, model: m, base_url: https://x}\n"
    "judge: {protocol: openai_compatible, model: m, base_url: https://x}\n"
)


def _write_config(
    tmp_path,
    *,
    authorized: bool = True,
    target: bool = True,
    objectives: int = 1,
    extra: str = "",
    name: str = "cfg.yaml",
) -> str:
    text = _ENDPOINTS
    if target:
        text += (
            "target: {protocol: openai_compatible, model: m, base_url: https://x, "
            f"authorized: {str(authorized).lower()}}}\n"
        )
    text += "objectives:\n" + "".join(
        f"  - {{title: t{i}, category: system_prompt_leak}}\n" for i in range(objectives)
    )
    text += extra
    p = tmp_path / name
    p.write_text(text, encoding="utf-8")
    return str(p)


def _svc(tmp_path, **kw) -> McpService:
    return McpService(runs_dir=tmp_path / "runs", config_dir=tmp_path, **kw)


class FakeClock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


@pytest.fixture
def engine(monkeypatch):
    """Replace the shared engine with a spy. Records every config it is handed."""
    from modelwrecker.attacker import loop

    calls: list = []

    async def fake_run_config(cfg, *, store=None, emit=None, run_id=None):
        calls.append(cfg)
        return loop.RunResult(run_id=run_id, objectives_run=len(cfg.objectives))

    monkeypatch.setattr(loop, "run_config", fake_run_config)
    return calls


def _denied(code: str, fn, *args, **kwargs) -> GuardrailError:
    """Assert a (sync or async) call is refused with this exact code; return the error."""
    with pytest.raises(GuardrailError) as ei:
        out = fn(*args, **kwargs)
        if asyncio.iscoroutine(out):
            asyncio.run(out)
    assert ei.value.code == code, f"expected {code}, got {ei.value.code}: {ei.value}"
    return ei.value


# --- happy path -----------------------------------------------------------------------------------


def test_run_happy_path_reaches_engine_with_bounded_config(tmp_path, engine) -> None:
    svc = _svc(tmp_path)
    _write_config(tmp_path)
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
    svc = _svc(tmp_path)
    assert svc.validate_config(_write_config(tmp_path, authorized=True))["ok"] is True
    bad = svc.validate_config(_write_config(tmp_path, authorized=False, name="bad.yaml"))
    assert bad["ok"] is False
    assert any("authorized" in p for p in bad["problems"])


def test_validate_config_runs_the_same_egress_check_as_the_cli(tmp_path) -> None:
    svc = _svc(tmp_path)
    text = Path(_write_config(tmp_path)).read_text(encoding="utf-8")
    blocked = tmp_path / "blocked.yaml"
    blocked.write_text(text.replace("base_url: https://x, ", "base_url: http://127.0.0.1, "),
                       encoding="utf-8")
    out = svc.validate_config(str(blocked))
    assert out["ok"] is False
    assert any("egress blocked" in p and "target.base_url" in p for p in out["problems"])


def test_get_report_reads_only_within_runs(tmp_path) -> None:
    svc = _svc(tmp_path)
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
    names = {s["name"] for s in _svc(tmp_path).list_strategies()}
    assert {"direct_jailbreak", "prompt_extraction"} <= names


# --- target scope ---------------------------------------------------------------------------------


def test_run_rejects_unauthorized_target(tmp_path, engine) -> None:
    svc = _svc(tmp_path)
    err = _denied("target_not_authorized", svc.run, _write_config(tmp_path, authorized=False),
                  run_id="r-unauth")
    assert err.check == "target_scope"
    assert engine == []
    assert not (tmp_path / "runs" / "r-unauth").exists()  # nothing was started or written


def test_run_rejects_unknown_target(tmp_path, engine) -> None:
    svc = _svc(tmp_path)
    err = _denied("unknown_target", svc.run, _write_config(tmp_path, target=False))
    assert err.check == "target_scope"
    assert engine == []


@pytest.mark.parametrize("override", [
    {"base_url": "http://169.254.169.254/latest"},
    {"target": {"base_url": "https://evil.example", "authorized": True}},
    {"endpoint": "https://evil.example/v1"},
    {"authorized": True},
])
def test_run_rejects_endpoint_override(tmp_path, engine, override) -> None:
    svc = _svc(tmp_path)
    _write_config(tmp_path, authorized=False)
    args = {"config_path": "cfg.yaml", **override}
    err = _denied("unexpected_argument", svc.call, "run", args)
    assert err.check == "tool_permission"
    assert engine == []


# --- tool permission ------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "tool", ["run_shell", "http_request", "read_file", "write_file", "", "RUN"]
)
def test_unknown_tool_rejected(tmp_path, engine, tool) -> None:
    err = _denied("unknown_tool", _svc(tmp_path).call, tool, {})
    assert err.check == "tool_permission"
    assert engine == []


def test_missing_required_argument_rejected(tmp_path, engine) -> None:
    _denied("missing_argument", _svc(tmp_path).call, "run", {})
    assert engine == []


# --- path scope -----------------------------------------------------------------------------------


def test_config_path_traversal_rejected(tmp_path, engine) -> None:
    base = tmp_path / "configs"
    base.mkdir()
    svc = McpService(runs_dir=tmp_path / "runs", config_dir=base)
    # A real, valid, authorized config OUTSIDE the allowed directory: only path scope stops it.
    outside = _write_config(tmp_path, name="outside.yaml")
    for bad in ("../outside.yaml", outside, "sub/../../outside.yaml"):
        _denied("path_out_of_scope", svc.run, bad)
        _denied("path_out_of_scope", svc.validate_config, bad)
    # Not a local yaml file.
    (base / "secrets.txt").write_text("api_key: sk-abcdefghijklmnopqrstuvwxyz", encoding="utf-8")
    for bad in ("secrets.txt", "http://evil.example/cfg.yaml", "", "a\x00.yaml"):
        _denied("invalid_path", svc.validate_config, bad)
    _denied("config_not_found", svc.run, "missing.yaml")
    assert engine == []
    # Calibration: the same config inside the allowed directory is accepted.
    _write_config(base, name="inside.yaml")
    assert asyncio.run(svc.run("inside.yaml"))["objectives_run"] == 1


def test_symlink_escape_rejected(tmp_path, engine) -> None:
    base = tmp_path / "configs"
    base.mkdir()
    outside = _write_config(tmp_path, name="outside.yaml")
    try:
        (base / "link.yaml").symlink_to(outside)
    except OSError:
        pytest.skip("symlinks not permitted on this machine")
    svc = McpService(runs_dir=tmp_path / "runs", config_dir=base)
    _denied("path_out_of_scope", svc.run, "link.yaml")
    assert engine == []


def test_run_id_traversal_rejected(tmp_path, engine) -> None:
    svc = _svc(tmp_path)
    cfg = _write_config(tmp_path)
    for bad in ("../secrets", "..", "a/b", "a\\b", ".hidden", "", "c:evil", "x" * 200):
        _denied("invalid_id", svc.get_findings, bad)
        _denied("invalid_id", svc.run, cfg, run_id=bad)
    RunStore(run_id="r1", base_dir=str(tmp_path / "runs"))
    _denied("invalid_id", svc.replay, "r1", "../../cfg")
    _denied("not_found", svc.get_findings, "no-such-run")
    _denied("run_exists", svc.run, cfg, run_id="r1")  # never overwrite an existing run
    assert engine == []


# --- resource limits (calibrated) -----------------------------------------------------------------

_OVERSIZED = [
    ("objectives", {"objectives": 11}),
    ("concurrency", {"extra": "campaign: {concurrency: 5}\n"}),
    ("retries", {"extra": "campaign: {retries: 4}\n"}),
    ("attempts", {"extra": "campaign: {budget: {max_attempts: 201}}\n"}),
    ("seconds", {"extra": "campaign: {budget: {max_seconds: 1801}}\n"}),
    ("deadline", {"extra": "engine: {deadline_seconds: 99999}\n"}),
    ("replays", {"extra": "engine: {replays: 17}\n"}),
    ("param", {"extra": "attack: {strategy: best_of_n, params: {n: 51}}\n"}),
]


@pytest.mark.parametrize("label,kw", _OVERSIZED, ids=[o[0] for o in _OVERSIZED])
def test_oversized_campaign_rejected(tmp_path, engine, label, kw) -> None:
    err = _denied("campaign_too_large", _svc(tmp_path).run, _write_config(tmp_path, **kw))
    assert err.check == "resource_limit"
    assert engine == []


def test_campaign_exactly_at_limits_is_allowed(tmp_path, engine) -> None:
    extra = (
        "campaign: {concurrency: 4, retries: 3, budget: {max_attempts: 200, max_seconds: 1800}}\n"
        "engine: {replays: 16}\n"
        "attack: {strategy: best_of_n, params: {n: 50}}\n"
    )
    asyncio.run(_svc(tmp_path).run(_write_config(tmp_path, objectives=10, extra=extra)))
    assert len(engine) == 1


def test_objective_budget_brings_large_config_within_limit(tmp_path, engine) -> None:
    extra = "campaign: {budget: {max_objectives: 10}}\n"
    asyncio.run(_svc(tmp_path).run(_write_config(tmp_path, objectives=30, extra=extra)))
    assert len(engine) == 1


# --- rate limits ----------------------------------------------------------------------------------


def test_call_rate_limit(tmp_path) -> None:
    clock = FakeClock()
    svc = _svc(tmp_path, limits=McpLimits(calls_per_minute=3), clock=clock)
    for _ in range(3):
        asyncio.run(svc.call("list_strategies", {}))
    err = _denied("rate_limited", svc.call, "list_strategies", {})
    assert err.check == "rate_limit"
    clock.t += 61  # the window slides; calls are admitted again
    asyncio.run(svc.call("list_strategies", {}))


def test_run_rate_limit(tmp_path, engine) -> None:
    clock = FakeClock()
    svc = _svc(tmp_path, limits=McpLimits(runs_per_hour=1), clock=clock)
    cfg = _write_config(tmp_path)
    asyncio.run(svc.run(cfg))
    _denied("run_rate_limited", svc.run, cfg)
    assert len(engine) == 1
    clock.t += 3601
    asyncio.run(svc.run(cfg))
    assert len(engine) == 2


def test_denied_run_does_not_use_a_run_slot(tmp_path, engine) -> None:
    svc = _svc(tmp_path, limits=McpLimits(runs_per_hour=1))
    _denied("target_not_authorized", svc.run,
            _write_config(tmp_path, authorized=False, name="no.yaml"))
    asyncio.run(svc.run(_write_config(tmp_path)))  # the one allowed run is still available
    assert len(engine) == 1


def test_only_one_active_run(tmp_path, monkeypatch) -> None:
    from modelwrecker.attacker import loop

    gate = asyncio.Event()
    started = asyncio.Event()

    async def slow_run_config(cfg, *, store=None, emit=None, run_id=None):
        started.set()
        await gate.wait()
        return loop.RunResult(run_id=run_id)

    monkeypatch.setattr(loop, "run_config", slow_run_config)
    svc = _svc(tmp_path)
    cfg = _write_config(tmp_path)

    async def scenario() -> None:
        first = asyncio.create_task(svc.run(cfg))
        await started.wait()
        with pytest.raises(GuardrailError) as ei:
            await svc.run(cfg)
        assert ei.value.code == "run_in_progress"
        gate.set()
        await first
        await svc.run(cfg)  # slot released after the first run finished

    asyncio.run(scenario())


def test_rate_limiter_window() -> None:
    clock = FakeClock()
    rl = RateLimiter(2, 10.0, clock)
    assert rl.try_acquire() and rl.try_acquire()
    assert not rl.try_acquire()
    clock.t += 10
    assert rl.try_acquire()


# --- entitlement hook -----------------------------------------------------------------------------


class _DenyAll:
    def __init__(self) -> None:
        self.asked: list[tuple[str, dict]] = []

    def check(self, operation, context):
        self.asked.append((operation, dict(context)))
        return EntitlementDecision(False, "plan does not include MCP runs")


class _Broken:
    def check(self, operation, context):
        raise RuntimeError("cannot verify signature")


class _NoAnswer:
    def check(self, operation, context):
        return True  # not an EntitlementDecision: must not count as allowed


@pytest.mark.parametrize("checker", [_DenyAll(), _Broken(), _NoAnswer()],
                         ids=["deny", "error", "malformed"])
def test_entitlement_denies_fail_safe(tmp_path, engine, checker) -> None:
    svc = _svc(tmp_path, entitlements=checker)
    err = _denied("not_entitled", svc.run, _write_config(tmp_path))
    assert err.check == "entitlement"
    assert engine == []


def test_entitlement_is_asked_with_operation_context(tmp_path, engine) -> None:
    checker = _DenyAll()
    with pytest.raises(GuardrailError):
        asyncio.run(_svc(tmp_path, entitlements=checker).run(_write_config(tmp_path)))
    assert checker.asked == [("run", {"target_type": "chat", "strategy": "auto", "objectives": 1})]


# --- denial shape and logging ---------------------------------------------------------------------


def test_denial_is_structured_and_logged_redacted(tmp_path, engine, caplog) -> None:
    secret = "sk-abcdefghijklmnopqrstuvwxyz0123"
    svc = _svc(tmp_path)
    _write_config(tmp_path)
    with caplog.at_level(logging.WARNING, logger="modelwrecker.mcp"):
        err = _denied("unexpected_argument", svc.call, "run",
                      {"config_path": "cfg.yaml", "api_key": secret, "note": f"Bearer {secret}"})
    assert err.to_dict() == {"denied": True, "check": "tool_permission",
                             "code": "unexpected_argument", "message": err.message}
    assert "unexpected_argument" in str(err)
    logged = caplog.text
    assert "mcp denied" in logged and "unexpected_argument" in logged
    assert secret not in logged
    assert "[REDACTED]" in logged
    assert engine == []


# --- the real MCP server --------------------------------------------------------------------------


def test_mcp_server_exposes_exactly_the_allowlist(tmp_path) -> None:
    from modelwrecker.mcp.server import build_server

    server = build_server(runs_dir=str(tmp_path / "runs"), config_dir=str(tmp_path))
    names = {t.name for t in asyncio.run(server.list_tools())}
    assert names == set(TOOL_ARGUMENTS)
    assert not ({"run_shell", "write_file", "http_request", "read_file"} & names)


def test_mcp_server_denials_reach_the_client(tmp_path, engine) -> None:
    """A real in-process MCP client round trip: denials are clear is_error results, not crashes."""
    from mcp import Client

    from modelwrecker.mcp.server import build_server

    _write_config(tmp_path, authorized=False, name="unauth.yaml")
    _write_config(tmp_path, name="ok.yaml")
    server = build_server(runs_dir=str(tmp_path / "runs"), config_dir=str(tmp_path))

    async def scenario() -> dict[str, tuple[bool, str]]:
        out: dict[str, tuple[bool, str]] = {}
        async with Client(server) as client:
            cases = {
                "unknown_tool": ("run_shell", {"command": "whoami"}),
                "override": ("run", {"config_path": "ok.yaml", "base_url": "http://10.0.0.1"}),
                "unauthorized": ("run", {"config_path": "unauth.yaml"}),
                "traversal": ("validate_config", {"config_path": "../../etc/passwd.yaml"}),
                "ok": ("run", {"config_path": "ok.yaml", "run_id": "srv-ok"}),
            }
            for label, (tool, args) in cases.items():
                res = await client.call_tool(tool, args)
                text = " ".join(getattr(c, "text", "") for c in res.content)
                out[label] = (res.is_error, text)
        return out

    out = asyncio.run(scenario())
    assert out["unknown_tool"][0] and "unknown_tool" in out["unknown_tool"][1]
    assert out["override"][0] and "unexpected_argument" in out["override"][1]
    assert out["unauthorized"][0] and "target_not_authorized" in out["unauthorized"][1]
    assert out["traversal"][0] and "path_out_of_scope" in out["traversal"][1]
    assert not out["ok"][0], out["ok"][1]
    assert len(engine) == 1  # only the authorized, in-scope run reached the engine
