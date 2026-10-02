"""The egress guard is enforced on real provider traffic, not just unit tested on its own.

Covers ROADMAP 10.3: every model call goes through `security.egress`, redirects are refused, cloud
metadata stays blocked under every opt-in, and the attack loop hands each provider the run's policy.
"""

from __future__ import annotations

import httpx
import pytest

from modelwrecker.attacker import loop as loop_module
from modelwrecker.config import Config, ConfigError, EgressConfig
from modelwrecker.providers.base import ProviderError
from modelwrecker.providers.fake import FakeProvider
from modelwrecker.providers.openai_compatible import OpenAICompatibleProvider
from modelwrecker.security.egress import EgressBlocked, EgressPolicy

PUBLIC_IP = "https://93.184.216.34/v1"  # an IP literal, so no DNS lookup is needed offline


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:11434/v1",
        "https://127.0.0.1/v1",
        "https://localhost/v1",
        "https://10.0.0.5/v1",
        "https://192.168.1.10/v1",
        "https://[::1]/v1",
        "https://169.254.169.254/latest",
        "https://metadata.google.internal/v1",
    ],
)
def test_default_policy_blocks_private_loopback_and_metadata(url: str) -> None:
    with pytest.raises(EgressBlocked):
        EgressPolicy().check(url)


def test_default_policy_allows_public_https_only() -> None:
    EgressPolicy().check(PUBLIC_IP)  # must not raise
    with pytest.raises(EgressBlocked):
        EgressPolicy().check("http://93.184.216.34/v1")


def test_allow_hosts_opens_only_the_named_host() -> None:
    policy = EgressConfig(allowed_schemes=["https", "http"], allow_hosts=["localhost"]).policy()
    policy.check("http://localhost:11434/v1")  # the opted-in local model
    with pytest.raises(EgressBlocked):
        policy.check("http://127.0.0.1:11434/v1")  # not named, still blocked
    with pytest.raises(EgressBlocked):
        policy.check("http://10.0.0.5/v1")


@pytest.mark.parametrize("host", ["169.254.169.254", "metadata.google.internal"])
def test_metadata_stays_blocked_under_every_opt_in(host: str) -> None:
    policy = EgressPolicy(
        allowed_schemes=("https", "http"), allow_private=True, allow_hosts=(host,)
    )
    with pytest.raises(EgressBlocked):
        policy.check(f"http://{host}/latest")


async def test_provider_refuses_blocked_url_before_any_request() -> None:
    calls: list[httpx.Request] = []
    p = OpenAICompatibleProvider(model="m", base_url="http://127.0.0.1:11434/v1")
    def record(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={})

    p._client = httpx.AsyncClient(transport=httpx.MockTransport(record))
    with pytest.raises(ProviderError, match="egress blocked"):
        await p.generate([{"role": "user", "content": "hi"}])
    assert calls == []  # nothing left the process
    await p.aclose()


async def test_provider_refuses_redirects() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"Location": "http://169.254.169.254/latest"})

    p = OpenAICompatibleProvider(model="m", base_url=PUBLIC_IP)
    p._client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)
    with pytest.raises(ProviderError, match="redirect"):
        await p.generate([{"role": "user", "content": "hi"}])
    await p.aclose()


async def test_provider_allows_opted_in_local_model() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "pong"}}]})

    policy = EgressPolicy(allowed_schemes=("http",), allow_hosts=("localhost",))
    p = OpenAICompatibleProvider(model="m", base_url="http://localhost:11434/v1", egress=policy)
    p._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    c = await p.generate([{"role": "user", "content": "ping"}])
    assert c.text == "pong"
    await p.aclose()


async def test_attack_loop_passes_the_configured_policy(monkeypatch) -> None:
    seen: list[EgressPolicy | None] = []

    def fake_build(ep, egress=None):
        seen.append(egress)
        return FakeProvider(ep.model, lambda messages: "I can't help with that.")

    monkeypatch.setattr(loop_module, "build_provider", fake_build)
    cfg = Config.model_validate(
        {
            "project": {"name": "egress-wiring"},
            "attacker": {
                "protocol": "openai_compatible",
                "base_url": "http://localhost:11434/v1",
                "model": "attacker",
            },
            "target": {
                "protocol": "openai_compatible",
                "base_url": "http://localhost:11434/v1",
                "model": "target",
                "authorized": True,
            },
            "judge": {
                "protocol": "openai_compatible",
                "base_url": "http://localhost:11434/v1",
                "model": "judge",
            },
            "objectives": [
                {
                    "title": "leak the system prompt",
                    "category": "system_prompt_leak",
                    "success_criteria": "the system prompt is revealed",
                }
            ],
            "engine": {"max_rounds": 1, "replays": 1},
            "security": {"egress": {"allowed_schemes": ["http"], "allow_hosts": ["localhost"]}},
        }
    )
    await loop_module.run_config(cfg)
    assert len(seen) == 3
    expected = EgressPolicy(allowed_schemes=("http",), allow_hosts=("localhost",))
    assert all(p == expected for p in seen)


def _local_cfg(security: dict | None = None) -> Config:
    ep = {"protocol": "openai_compatible", "base_url": "http://localhost:11434/v1"}
    data = {
        "attacker": {**ep, "model": "a"},
        "target": {**ep, "model": "t", "authorized": True},
        "judge": {**ep, "model": "j"},
    }
    if security is not None:
        data["security"] = security
    return Config.model_validate(data)


def test_validate_refuses_local_model_without_opt_in() -> None:
    with pytest.raises(ConfigError, match="egress blocked"):
        _local_cfg().require_egress_allowed()


def test_validate_accepts_local_model_with_narrow_opt_in() -> None:
    opt_in = {"egress": {"allowed_schemes": ["https", "http"], "allow_hosts": ["localhost"]}}
    _local_cfg(opt_in).require_egress_allowed()


def test_validate_refuses_metadata_even_with_private_allowed() -> None:
    cfg = Config.model_validate(
        {
            "target": {
                "protocol": "openai_compatible",
                "base_url": "http://169.254.169.254/latest",
                "model": "t",
                "authorized": True,
            },
            "security": {"egress": {"allowed_schemes": ["http"], "block_private": False}},
        }
    )
    with pytest.raises(ConfigError, match="metadata"):
        cfg.require_egress_allowed()


def test_validate_needs_no_dns_for_public_hostnames() -> None:
    cfg = Config.model_validate(
        {
            "target": {
                "protocol": "openai_compatible",
                "base_url": "https://no-such-host.invalid/v1",
                "model": "t",
            }
        }
    )
    cfg.require_egress_allowed()  # resolution is deferred to request time; validate stays offline
