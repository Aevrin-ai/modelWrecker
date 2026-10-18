"""Device sign-in (RFC 8628 device flow), the login command, and cloud API URL safety.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in
a temporary folder (see conftest.py).
"""

from __future__ import annotations

import json

import httpx
import pytest
from cloud_fakes import (
    API,
    TOKEN,
    Api,
    FakeClock,
    client_for,
    fake_device_code,
    granted_reply,
    pending_reply,
)
from typer.testing import CliRunner

from modelwrecker import cli
from modelwrecker.cli import cloud_session
from modelwrecker.cloud import (
    CloudClient,
    CloudError,
    InsecureUrlError,
    TokenStatus,
    credential_path,
    load_credential,
    poll_for_token,
    validate_api_url,
)

runner = CliRunner()


def test_device_flow_happy_path_with_pending() -> None:
    api = Api(token_replies=[pending_reply(), pending_reply(), granted_reply()])
    clock = FakeClock()
    with client_for(api) as c:
        code = c.device_code(name="laptop", os_name="Windows 11", engine_version="0.0.1")
        out = poll_for_token(c, code, sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.OK
    assert out.token.device_token == TOKEN and out.token.device_id == "dev-uuid"
    assert out.token.project_id == "proj-uuid"
    assert clock.sleeps == [5, 5, 5]  # waits the interval before every poll
    assert api.paths()[0] == "/api/v1/device/code"
    first = json.loads(api.requests[0].content)
    assert first == {"name": "laptop", "os": "Windows 11", "engine_version": "0.0.1"}
    assert all("authorization" not in r.headers for r in api.requests)  # public routes
    assert TOKEN not in repr(out)


def test_device_flow_slow_down_adds_five_seconds() -> None:
    api = Api(token_replies=[pending_reply(), (400, {"error": "slow_down"}), pending_reply(),
                             granted_reply()])
    clock = FakeClock()
    out = poll_for_token(client_for(api), fake_device_code(), sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.OK
    assert clock.sleeps == [5, 5, 10, 10]


def test_device_flow_expired_from_server() -> None:
    api = Api(token_replies=[pending_reply(), (400, {"error": "expired_token"})])
    clock = FakeClock()
    out = poll_for_token(client_for(api), fake_device_code(), sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.EXPIRED and out.token is None


def test_device_flow_expires_locally_without_endless_polling() -> None:
    api = Api(token_replies=[pending_reply()] * 50)
    clock = FakeClock()
    out = poll_for_token(client_for(api), fake_device_code(expires_in=12, interval=5),
                         sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.EXPIRED
    assert len(api.requests) == 2  # polls at t=5 and t=10, then stops before passing 12


def test_device_flow_denied() -> None:
    api = Api(token_replies=[pending_reply(), (400, {"error": "access_denied"})])
    clock = FakeClock()
    out = poll_for_token(client_for(api), fake_device_code(), sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.DENIED


def test_device_token_unexpected_error_raises() -> None:
    api = Api(token_replies=[(500, {"error": "internal", "message": "boom"})])
    with pytest.raises(CloudError) as ei:
        client_for(api).device_token("dc")
    assert ei.value.status == 500 and not ei.value.refused


def test_cli_login_saves_credential_and_never_prints_token(monkeypatch) -> None:
    api = Api(token_replies=[pending_reply(), granted_reply()])
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    monkeypatch.setattr(cloud_session, "_sleep", lambda s: None)
    result = runner.invoke(cli.app, ["login", "--name", "ci-box"])
    assert result.exit_code == 0, result.output
    assert "WDJB-MJHT" in result.output
    assert "https://cloud.test/dashboard/connect?code=WDJB-MJHT" in result.output
    assert "dev-uuid" in result.output
    assert TOKEN not in result.output
    cred = load_credential()
    assert cred.token == TOKEN and cred.device_id == "dev-uuid" and cred.project_id == "proj-uuid"
    assert cred.api_url == "https://app.aevrin.net/api/v1"  # the default; nothing set it


def test_cli_login_denied_saves_nothing(monkeypatch) -> None:
    api = Api(token_replies=[(400, {"error": "access_denied"})])
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    monkeypatch.setattr(cloud_session, "_sleep", lambda s: None)
    result = runner.invoke(cli.app, ["login"])
    assert result.exit_code == 1
    assert "denied" in result.output
    assert not credential_path().exists()


@pytest.mark.parametrize("url", [
    "http://app.aevrin.net/api/v1",
    "http://localhost.evil.example/api/v1",
    "http://10.0.0.5/api/v1",
    "ftp://app.aevrin.net/api/v1",
    # built from parts so the source never holds a URL that looks like a real credential
    "https://user:" + "pw@app.aevrin.net/api/v1",
    "https://app.aevrin.net/api/v1?x=1",
    "not a url",
])
def test_non_https_or_unsafe_url_is_refused(url) -> None:
    with pytest.raises(InsecureUrlError):
        validate_api_url(url)


@pytest.mark.parametrize("url", [
    "https://app.aevrin.net/api/v1/",
    "http://localhost:8787/api/v1",
    "http://127.0.0.1:8787/api/v1",
])
def test_https_and_local_dev_urls_are_allowed(url) -> None:
    assert validate_api_url(url) == url.rstrip("/")


def test_env_url_is_validated_before_any_request(monkeypatch) -> None:
    monkeypatch.setenv("MODELWRECKER_CLOUD_URL", "http://cloud.example/api/v1")
    with pytest.raises(InsecureUrlError):
        CloudClient()
    result = runner.invoke(cli.app, ["login"])
    assert result.exit_code == 2
    assert "https" in result.output


def test_redirects_are_not_followed() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(302, headers={"Location": "https://evil.example/steal"})

    c = CloudClient(API, TOKEN, transport=httpx.MockTransport(handler))
    with pytest.raises(CloudError) as ei:
        c.heartbeat()
    assert ei.value.code == "redirect_refused"
    assert len(seen) == 1  # the token never went to the redirect target
