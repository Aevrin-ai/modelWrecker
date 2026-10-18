"""Signed entitlements, engine side: the run gate, plan limits, the plan command, and the cloud.

Offline: tokens are signed with the test key from conftest.py, and the engine trusts only that key.
"""

from __future__ import annotations

import asyncio

import httpx
import pytest
from entitlement_fakes import FREE_FEATURES
from typer.testing import CliRunner

from modelwrecker.attacker import loop as loop_module
from modelwrecker.cli import app
from modelwrecker.cloud import CloudClient
from modelwrecker.config import AttackConfig, Config, Endpoint, EngineConfig
from modelwrecker.data import Objective
from modelwrecker.entitlements import (
    EntitlementDenied,
    check_run,
    load,
    record_run,
)
from modelwrecker.entitlements import store as ent_store
from modelwrecker.providers.fake import FakeProvider


def _config(strategy: str = "auto", target_type: str | None = None) -> Config:
    return Config(
        attacker=Endpoint(protocol="openai_compatible", model="attacker", base_url="http://x"),
        target=Endpoint(protocol="openai_compatible", model="target", base_url="http://x",
                        authorized=True, type=target_type, system="The code is ZZZ."),
        judge=Endpoint(protocol="openai_compatible", model="judge", base_url="http://x"),
        attack=AttackConfig(strategy=strategy),
        engine=EngineConfig(max_rounds=3, replays=2, reliable_threshold=0.6),
        objectives=[Objective(title="leak", category="system_prompt_leak",
                              success_criteria="reveals ZZZ")],
    )


def _fake_providers(monkeypatch: pytest.MonkeyPatch) -> None:
    def build(ep: Endpoint, egress: object = None) -> FakeProvider:
        if ep.model == "judge":
            return FakeProvider("judge", lambda _m: '{"refused": 1, "score": 1, "rationale": "no"}')
        return FakeProvider(ep.model, lambda _m: "I can't help with that.")
    monkeypatch.setattr(loop_module, "build_provider", build)


@pytest.mark.free_plan
def test_free_baseline_refuses_mcp_targets_and_explicit_advanced_strategies() -> None:
    with pytest.raises(EntitlementDenied, match="MCP targets"):
        check_run(_config(target_type="mcp"))
    with pytest.raises(EntitlementDenied, match="pyrit_pair"):
        check_run(_config(strategy="pyrit_pair"))
    allowance = check_run(_config())
    assert allowance.remaining_attempts == 2000
    assert not allowance.strategy_allowed("garak_probe")
    assert allowance.strategy_allowed("crescendo")


def test_pro_allows_advanced_strategies_and_mcp(sign_entitlement, monkeypatch) -> None:
    monkeypatch.setenv("MODELWRECKER_ENTITLEMENT", sign_entitlement(
        plan="pro", limits={"campaigns": 300, "attacks": 100000, "devices": 10, "projects": 25},
        features=FREE_FEATURES | {"advanced_strategies": True, "mcp": True}))
    allowance = check_run(_config(strategy="pyrit_pair", target_type="mcp"))
    assert allowance.entitlement.plan == "pro"
    assert allowance.remaining_attempts == 100000


@pytest.mark.free_plan
def test_monthly_limits_count_local_and_signed_usage(sign_entitlement, monkeypatch) -> None:
    for _ in range(20):
        record_run(10)
    with pytest.raises(EntitlementDenied, match="20 campaign runs"):
        check_run(_config())

    # A signed token whose cloud count is higher than this machine's count wins.
    period = ent_store.period_key()
    monkeypatch.setenv("MODELWRECKER_ENTITLEMENT", sign_entitlement(
        plan="pro", limits={"campaigns": 300, "attacks": 1000, "devices": 10, "projects": 25},
        features=FREE_FEATURES, usage={"period": period, "campaigns": 3, "attacks": 990}))
    assert check_run(_config()).remaining_attempts == 10
    monkeypatch.setenv("MODELWRECKER_ENTITLEMENT", sign_entitlement(
        plan="pro", limits={"campaigns": 300, "attacks": 1000, "devices": 10, "projects": 25},
        features=FREE_FEATURES, usage={"period": period, "campaigns": 3, "attacks": 1000}))
    with pytest.raises(EntitlementDenied, match="attack attempts"):
        check_run(_config())


@pytest.mark.free_plan
def test_a_run_on_free_skips_advanced_strategies_caps_attempts_and_is_counted(monkeypatch) -> None:
    _fake_providers(monkeypatch)
    for _ in range(3):
        ent_store.record_usage(attacks=666)  # 1998 of 2000 used: two attempts left
    events = []
    result = asyncio.run(loop_module.run_config(_config(), emit=events.append))
    assert any("2 attack attempts left" in n for n in result.notes)
    assert any("free baseline" in n for n in result.notes)
    assert ent_store.read_usage()["campaigns"] == 1
    # checked before each strategy, so the one that started under the cap may finish a few over
    assert 2000 <= ent_store.read_usage()["attacks"] < 2010
    with pytest.raises(EntitlementDenied):
        check_run(_config())


@pytest.mark.free_plan
def test_the_planner_skips_a_strategy_the_plan_lacks(monkeypatch) -> None:
    from modelwrecker.attacker import planner

    _fake_providers(monkeypatch)
    monkeypatch.setitem(planner._AUTO_ORDER, "system_prompt_leak",
                        ["garak_probe", "prompt_extraction"])
    events: list[str] = []
    asyncio.run(loop_module.run_config(_config(), emit=events.append))
    assert any("skip garak_probe: not included in your plan" in e for e in events)


@pytest.mark.free_plan
def test_plan_command_shows_the_free_baseline() -> None:
    out = CliRunner().invoke(app, ["plan"])
    assert out.exit_code == 0, out.output
    assert "plan: Free" in out.output
    assert "attack attempts this month: 0 of 2000" in out.output
    assert "MCP targets: no (Pro)" in out.output


@pytest.mark.free_plan
def test_run_refuses_an_mcp_target_on_free_before_creating_anything(tmp_path) -> None:
    cfg = tmp_path / "mw.yaml"
    cfg.write_text(
        "target:\n  protocol: openai_compatible\n  model: t\n  base_url: http://x\n"
        "  authorized: true\n  type: mcp\n"
        "attacker:\n  protocol: openai_compatible\n  model: a\n  base_url: http://x\n"
        "judge:\n  protocol: openai_compatible\n  model: j\n  base_url: http://x\n"
        "objectives:\n  - title: t\n    category: mcp_tool_poisoning\n"
        "    success_criteria: s\n",
        encoding="utf-8")
    out = CliRunner().invoke(app, ["run", str(cfg), "--out-dir", str(tmp_path / "runs"),
                                   "--no-sync"])
    assert out.exit_code == 2, out.output
    assert "not allowed by your plan" in out.output
    assert not (tmp_path / "runs").exists()


@pytest.mark.free_plan
def test_heartbeat_stores_a_valid_entitlement_and_ignores_a_bad_one(sign_entitlement) -> None:
    good = sign_entitlement(plan="pro")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True, "sync": {}, "entitlement": good})

    with CloudClient("https://app.aevrin.net/api/v1", "mwd_x",
                     transport=httpx.MockTransport(handler)) as c:
        c.heartbeat()
    assert load()[0].plan == "pro"

    def bad(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True, "entitlement": good[:-4] + "AAAA"})

    with CloudClient("https://app.aevrin.net/api/v1", "mwd_x",
                     transport=httpx.MockTransport(bad)) as c:
        c.heartbeat()
    assert load()[0].plan == "pro"  # the bad token did not replace the good one


@pytest.mark.free_plan
def test_refresh_entitlement_fetches_and_stores(sign_entitlement) -> None:
    token = sign_entitlement(plan="pro")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET" and request.url.path == "/api/v1/device/entitlement"
        assert request.headers["authorization"] == "Bearer mwd_x"
        return httpx.Response(200, json={"entitlement": token, "plan": "pro"})

    with CloudClient("https://app.aevrin.net/api/v1", "mwd_x",
                     transport=httpx.MockTransport(handler)) as c:
        ent = c.refresh_entitlement()
    assert ent.plan == "pro" and load()[0].plan == "pro"
