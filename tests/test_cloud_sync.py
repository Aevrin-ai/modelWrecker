"""Cloud sync, engine side: device sign-in, credential storage, the sync summary, and the outbox.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in a
temporary folder (see conftest.py). The privacy tests plant a secret in every sensitive place of a
run folder and assert the sync body carries none of it; a calibration test proves the check catches
a leaky summarizer.
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

import httpx
import pytest
from typer.testing import CliRunner

from modelwrecker import cli
from modelwrecker.cloud import (
    MARKER,
    CloudClient,
    CloudError,
    CredentialError,
    DeviceCode,
    DeviceCredential,
    InsecureUrlError,
    TokenStatus,
    build_sync_body,
    credential_path,
    delete_credential,
    load_credential,
    pending_runs,
    poll_for_token,
    save_credential,
    summarize,
    sync_pending,
    validate_api_url,
)
from modelwrecker.cloud import credentials as creds_mod
from modelwrecker.data import (
    Confidence,
    Evidence,
    Finding,
    Objective,
    Outcome,
    ReliabilityResult,
    Severity,
    TaxonomyRef,
    ToolCall,
    Verdict,
)
from modelwrecker.security.redaction import redact_text
from modelwrecker.storage.store import RunStore

API = "https://cloud.test/api/v1"
TOKEN = "mwd_" + "T0kenValueForTestsOnly_abcdefghijklmnop"
SECRET = "PLANTED-7f3a9c"
RUN_ID = "20261002-020850-e4a5e2ae"
runner = CliRunner()


# --- helpers --------------------------------------------------------------------------------------


class FakeClock:
    def __init__(self) -> None:
        self.t = 0.0
        self.sleeps: list[float] = []

    def sleep(self, s: float) -> None:
        self.sleeps.append(s)
        self.t += s

    def now(self) -> float:
        return self.t


class Api:
    """A scripted fake of the control-plane API. Records every request."""

    def __init__(self, token_replies=(), sync_replies=(), heartbeat=(200, {"ok": True})) -> None:
        self.token_replies = list(token_replies)
        self.sync_replies = list(sync_replies)
        self.heartbeat = heartbeat
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if path.endswith("/device/code"):
            return httpx.Response(200, json={
                "device_code": "dc-" + "x" * 40, "user_code": "WDJB-MJHT",
                "verification_uri": "https://cloud.test/dashboard/connect",
                "verification_uri_complete": "https://cloud.test/dashboard/connect?code=WDJB-MJHT",
                "expires_in": 900, "interval": 5,
            })
        if path.endswith("/device/token"):
            status, body = self.token_replies.pop(0)
            return httpx.Response(status, json=body)
        if path.endswith("/device/heartbeat"):
            return httpx.Response(self.heartbeat[0], json=self.heartbeat[1])
        if path.endswith("/sync"):
            reply = self.sync_replies.pop(0) if self.sync_replies else (200, _ok())
            if isinstance(reply, Exception):
                raise reply
            return httpx.Response(reply[0], json=reply[1])
        return httpx.Response(404, json={"error": "not_found"})

    def paths(self) -> list[str]:
        return [r.url.path for r in self.requests]

    def sync_bodies(self) -> list[dict]:
        return [json.loads(r.content) for r in self.requests if r.url.path.endswith("/sync")]


def _ok(**extra) -> dict:
    return {"ok": True, "campaign_id": "c-uuid", "run_id": "r-uuid", "findings": 1, **extra}


def _pending() -> tuple[int, dict]:
    return 400, {"error": "authorization_pending"}


def _granted() -> tuple[int, dict]:
    return 200, {"device_token": TOKEN, "device_id": "dev-uuid", "project_id": "proj-uuid"}


def _client(api: Api, token: str | None = None) -> CloudClient:
    return CloudClient(API, token, transport=httpx.MockTransport(api))


def _code(expires_in: int = 900, interval: int = 5) -> DeviceCode:
    return DeviceCode("dc", "WDJB-MJHT", "https://x/c", "https://x/c?code=WDJB-MJHT",
                      expires_in, interval)


def _make_run(
    base: Path,
    run_id: str = RUN_ID,
    project: str | None = "local-smoke-test",
    finding_strategy: str | None = "crescendo",
) -> Path:
    """A realistic run folder with a secret planted in every place the sync must never read."""
    store = RunStore(run_id=run_id, base_dir=base)
    store.event("run_meta", target_model="llama3", target_provider="openai_compatible",
                run_id=run_id, target_type="chat", project_name=project)
    obj = Objective(title="Extract the target's hidden system prompt",
                    category="system_prompt_leak",
                    description=f"{SECRET}-objective-description",
                    success_criteria=f"{SECRET}-success-criteria")
    for strategy, outcome in (("crescendo", "success"), ("crescendo", "partial"),
                              ("crescendo", "refused"), ("direct_jailbreak", "refused")):
        store.event("attempt", objective=obj.title, strategy=strategy,
                    payload=f"{SECRET}-event-payload", response=f"{SECRET}-event-response",
                    outcome=outcome, score=9 if outcome == "success" else 1,
                    category=obj.category)
    evidence = Evidence(
        target={"model": "llama3", "base_url": f"https://{SECRET}-base-url.example/v1"},
        objective=obj,
        strategy="eb3934ceb9624ce29c033e76d0f28047",  # the engine stores the plan id here
        strategy_params={"hint": f"{SECRET}-strategy-params"},
        payload=f"{SECRET}-evidence-payload",
        target_response=f"{SECRET}-evidence-response",
        target_reasoning=f"{SECRET}-reasoning",
        tool_calls=[ToolCall(name="shell", args={"cmd": f"{SECRET}-tool-args"})],
        judge_result=Verdict(observation_id="o1", outcome=Outcome.SUCCESS, score=9,
                             rationale=f"{SECRET}-judge-rationale"),
        reliability=ReliabilityResult(attempt_id="a1", attempts_run=20, successes=17,
                                      success_rate=0.85, ci_low=0.6396, ci_high=0.9476,
                                      confidence=Confidence.RELIABLE),
        model={"model": "llama3", "provider": "openai_compatible"},
        provider={"base_url": f"https://{SECRET}-provider-url.example"},
        configuration={"target": {"base_url": f"https://{SECRET}-config-url.example/v1",
                                  "system": f"{SECRET}-system-prompt",
                                  "api_key_env": "OPENROUTER_API_KEY"}},
        attack_sequence=[{"role": "user", "content": f"{SECRET}-attack-sequence"}],
        reproduction_steps=f"{SECRET}-repro-steps",
    )
    finding = Finding(
        objective_id=obj.id, attempt_id="a1", severity=Severity.CRITICAL, title=obj.title,
        summary=f"{SECRET}-finding-summary",
        taxonomy=[TaxonomyRef(framework="owasp_llm", id="LLM07", edition="2025",
                              title="System Prompt Leakage")],
        evidence_id=evidence.id, run_id=run_id,
    )
    evidence.finding_id = finding.id
    store.save_evidence(evidence)
    store.save_finding(finding)
    extra = {"strategy": finding_strategy} if finding_strategy else {}
    store.event("finding", id=finding.id, severity="critical", title=finding.title, **extra)
    return store.dir


def _assert_private(body: dict) -> None:
    text = json.dumps(body)
    assert SECRET not in text, "the sync body leaked content from the run folder"
    for banned in ("payload", "response", "reasoning", "system", "base_url", "api_key",
                   "tool_calls", "args", "attack_sequence", "reproduction", "summary", "rationale"):
        assert f'"{banned}' not in text, f"the sync body has a forbidden field: {banned}"


# --- device sign-in -------------------------------------------------------------------------------


def test_device_flow_happy_path_with_pending() -> None:
    api = Api(token_replies=[_pending(), _pending(), _granted()])
    clock = FakeClock()
    with _client(api) as c:
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
    api = Api(token_replies=[_pending(), (400, {"error": "slow_down"}), _pending(), _granted()])
    clock = FakeClock()
    out = poll_for_token(_client(api), _code(), sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.OK
    assert clock.sleeps == [5, 5, 10, 10]


def test_device_flow_expired_from_server() -> None:
    api = Api(token_replies=[_pending(), (400, {"error": "expired_token"})])
    clock = FakeClock()
    out = poll_for_token(_client(api), _code(), sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.EXPIRED and out.token is None


def test_device_flow_expires_locally_without_endless_polling() -> None:
    api = Api(token_replies=[_pending()] * 50)
    clock = FakeClock()
    out = poll_for_token(_client(api), _code(expires_in=12, interval=5), sleep=clock.sleep,
                         clock=clock.now)
    assert out.status is TokenStatus.EXPIRED
    assert len(api.requests) == 2  # polls at t=5 and t=10, then stops before passing 12


def test_device_flow_denied() -> None:
    api = Api(token_replies=[_pending(), (400, {"error": "access_denied"})])
    clock = FakeClock()
    out = poll_for_token(_client(api), _code(), sleep=clock.sleep, clock=clock.now)
    assert out.status is TokenStatus.DENIED


def test_device_token_unexpected_error_raises() -> None:
    api = Api(token_replies=[(500, {"error": "internal", "message": "boom"})])
    with pytest.raises(CloudError) as ei:
        _client(api).device_token("dc")
    assert ei.value.status == 500 and not ei.value.refused


def test_cli_login_saves_credential_and_never_prints_token(monkeypatch) -> None:
    api = Api(token_replies=[_pending(), _granted()])
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    monkeypatch.setattr(cli, "_sleep", lambda s: None)
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
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    monkeypatch.setattr(cli, "_sleep", lambda s: None)
    result = runner.invoke(cli.app, ["login"])
    assert result.exit_code == 1
    assert "denied" in result.output
    assert not credential_path().exists()


# --- URL safety -----------------------------------------------------------------------------------


@pytest.mark.parametrize("url", [
    "http://app.aevrin.net/api/v1",
    "http://localhost.evil.example/api/v1",
    "http://10.0.0.5/api/v1",
    "ftp://app.aevrin.net/api/v1",
    "https://user:pw@app.aevrin.net/api/v1",
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


# --- credentials ----------------------------------------------------------------------------------


def test_credential_round_trip_and_permissions() -> None:
    path = save_credential(DeviceCredential(token=TOKEN, device_id="d1", project_id=None,
                                            api_url=API))
    assert path == credential_path()
    raw = json.loads(path.read_text(encoding="utf-8"))
    assert set(raw) == {"device_id", "project_id", "token", "api_url", "created_at"}
    assert raw["created_at"].endswith("Z")
    cred = load_credential()
    assert (cred.token, cred.device_id, cred.project_id, cred.api_url, cred.source) == (
        TOKEN, "d1", None, API, "file")
    if os.name != "nt":  # POSIX: owner-only. Windows ignores mode bits (best effort).
        assert stat.S_IMODE(path.stat().st_mode) == 0o600
        assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700
    assert not list(path.parent.glob("*.tmp"))  # atomic write left no temp file
    assert TOKEN not in repr(cred) and TOKEN not in str(cred)


def test_env_token_takes_precedence(monkeypatch) -> None:
    save_credential(DeviceCredential(token="mwd_fileTokenAAAAAAAAAAAA", device_id="d1",
                                     api_url=API))
    monkeypatch.setenv("MODELWRECKER_DEVICE_TOKEN", TOKEN)
    cred = load_credential()
    assert cred.token == TOKEN and cred.source == "env" and cred.api_url == ""


def test_no_credential_and_logout(monkeypatch) -> None:
    assert load_credential() is None
    save_credential(DeviceCredential(token=TOKEN, device_id="d1", api_url=API))
    result = runner.invoke(cli.app, ["logout"])
    assert result.exit_code == 0
    assert not credential_path().exists()
    assert load_credential() is None
    assert delete_credential() is False


def test_malformed_credential_never_echoes_content() -> None:
    p = credential_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text('{"token": "' + TOKEN + '", oops', encoding="utf-8")
    with pytest.raises(CredentialError) as ei:
        load_credential()
    assert TOKEN not in str(ei.value)


def test_default_credential_path_per_platform(tmp_path) -> None:
    win = creds_mod.default_credential_path({"APPDATA": str(tmp_path / "Roaming")}, "win32")
    assert win == tmp_path / "Roaming" / "modelwrecker" / "device.json"
    xdg = creds_mod.default_credential_path({"XDG_CONFIG_HOME": str(tmp_path / "xdg")}, "linux")
    assert xdg == tmp_path / "xdg" / "modelwrecker" / "device.json"
    home = creds_mod.default_credential_path({}, "linux")
    assert home == Path.home() / ".config" / "modelwrecker" / "device.json"


def test_device_tokens_are_redacted_from_text() -> None:
    assert TOKEN not in redact_text(f"Authorization failed for {TOKEN}")


# --- the sync body --------------------------------------------------------------------------------


def test_sync_body_matches_the_contract_keys_exactly(tmp_path) -> None:
    body = build_sync_body(_make_run(tmp_path))
    # Literal key sets from docs/architecture/control-plane-api.md, written out on purpose so a
    # change to the module's own constants cannot make this test pass by accident.
    assert set(body) == {"schema", "engine_version", "run"}
    run = body["run"]
    assert set(run) == {
        "run_id", "campaign", "target", "started_at", "completed_at", "attempts", "successes",
        "partials", "refusals", "errors", "asr", "asr_ci_low", "asr_ci_high", "by_strategy",
        "findings",
    }
    assert set(run["campaign"]) == {"external_id", "name"}
    assert set(run["target"]) == {"name", "type", "model", "provider"}
    for s in run["by_strategy"]:
        assert set(s) == {"strategy", "attempts", "successes", "partials"}
    assert len(run["findings"]) == 1
    f = run["findings"][0]
    assert set(f) == {
        "id", "title", "severity", "score", "strategy", "taxonomy", "replays", "successes",
        "success_rate", "ci_low", "ci_high", "confidence", "discovered_at",
    }
    for t in f["taxonomy"]:
        assert set(t) == {"framework", "id"}


def test_sync_body_values(tmp_path) -> None:
    body = build_sync_body(_make_run(tmp_path), engine_version="0.0.1")
    run = body["run"]
    assert body["schema"] == 1 and body["engine_version"] == "0.0.1"
    assert run["run_id"] == RUN_ID
    assert run["campaign"] == {"external_id": "local-smoke-test", "name": "local-smoke-test"}
    assert run["target"] == {"name": "llama3", "type": "chat", "model": "llama3",
                             "provider": "openai_compatible"}
    assert (run["attempts"], run["successes"], run["partials"], run["refusals"], run["errors"]) == (
        4, 1, 1, 2, 0)
    assert run["asr"] == 0.25
    assert 0 < run["asr_ci_low"] < 0.25 < run["asr_ci_high"] < 1
    assert run["by_strategy"][0] == {"strategy": "crescendo", "attempts": 3, "successes": 1,
                                     "partials": 1}
    assert run["started_at"].endswith("Z") and run["completed_at"] >= run["started_at"]
    f = run["findings"][0]
    assert (f["severity"], f["score"], f["strategy"], f["confidence"]) == (
        "critical", 9, "crescendo", "reliable")
    assert (f["replays"], f["successes"], f["success_rate"]) == (20, 17, 0.85)
    assert (f["ci_low"], f["ci_high"]) == (0.6396, 0.9476)
    assert f["taxonomy"] == [{"framework": "owasp_llm", "id": "LLM07"}]


def test_finding_strategy_comes_from_the_finding_event_not_the_plan_id(tmp_path) -> None:
    run = build_sync_body(_make_run(tmp_path, finding_strategy="many_shot"))["run"]
    assert run["findings"][0]["strategy"] == "many_shot"


def test_finding_strategy_falls_back_to_last_success_for_older_runs(tmp_path) -> None:
    run = build_sync_body(_make_run(tmp_path, finding_strategy=None))["run"]
    assert run["findings"][0]["strategy"] == "crescendo"  # never the plan id in evidence


def test_campaign_falls_back_to_run_id_without_project_name(tmp_path) -> None:
    run = build_sync_body(_make_run(tmp_path, project=None))["run"]
    assert run["campaign"] == {"external_id": RUN_ID, "name": RUN_ID}


def test_privacy_sync_body_carries_no_run_content(tmp_path) -> None:
    run_dir = _make_run(tmp_path)
    # Calibration: the secret really is in the run folder, in every sensitive place.
    on_disk = "".join(p.read_text(encoding="utf-8") for p in run_dir.glob("*.json*"))
    for where in ("evidence-payload", "evidence-response", "event-payload", "event-response",
                  "system-prompt", "base-url", "config-url", "tool-args", "attack-sequence",
                  "reasoning"):
        assert f"{SECRET}-{where}" in on_disk, where
    body = build_sync_body(run_dir)
    _assert_private(body)


def test_privacy_check_is_calibrated_against_a_leaky_summarizer(tmp_path, monkeypatch) -> None:
    """If summarize ever copies evidence.payload, even into an allowed field, the check fails."""
    run_dir = _make_run(tmp_path)
    real = summarize._finding

    def leaky(d, f, *rest):
        out = real(d, f, *rest)
        out["title"] += summarize._read_evidence(d, f.evidence_id)["payload"]
        return out

    monkeypatch.setattr(summarize, "_finding", leaky)
    with pytest.raises(AssertionError):
        _assert_private(build_sync_body(run_dir))


# --- outbox ---------------------------------------------------------------------------------------


def test_outbox_marks_synced_only_after_200_and_retries_after_500(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = _make_run(runs)
    assert pending_runs(runs) == [run_dir]

    api = Api(sync_replies=[(500, {"error": "internal", "message": "db down"})])
    report = sync_pending(_client(api, TOKEN), runs)
    assert report.synced == [] and len(report.deferred) == 1 and report.ok
    assert not (run_dir / MARKER).exists()
    assert pending_runs(runs) == [run_dir]  # still queued

    api2 = Api(sync_replies=[(200, _ok())])
    report = sync_pending(_client(api2, TOKEN), runs)
    assert report.synced == [run_dir.name]
    marker = json.loads((run_dir / MARKER).read_text(encoding="utf-8"))
    assert marker["campaign_id"] == "c-uuid" and marker["run_id"] == "r-uuid"
    assert marker["synced_at"].endswith("Z")
    assert pending_runs(runs) == []
    req = api2.requests[0]
    assert req.headers["authorization"] == f"Bearer {TOKEN}"
    _assert_private(json.loads(req.content))


def test_outbox_refusal_and_network_failure_keep_runs_queued(tmp_path) -> None:
    runs = tmp_path / "runs"
    a = _make_run(runs, run_id="20261002-000001-aaaaaaaa")
    b = _make_run(runs, run_id="20261002-000002-bbbbbbbb")

    api = Api(sync_replies=[(401, {"error": "unauthorized", "message": "revoked"}), (200, _ok())])
    report = sync_pending(_client(api, TOKEN), runs)
    assert [n for n, _ in report.refused] == [a.name] and report.synced == [b.name]
    assert not report.ok and pending_runs(runs) == [a]

    api2 = Api(sync_replies=[httpx.ConnectError("offline")])
    report = sync_pending(_client(api2, TOKEN), runs)
    assert report.ok and [n for n, _ in report.deferred] == [a.name]
    assert pending_runs(runs) == [a]


def test_a_run_that_grows_after_sync_is_pending_again(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = _make_run(runs)
    sync_pending(_client(Api(), TOKEN), runs)
    assert pending_runs(runs) == []
    with open(run_dir / "events.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": "2026-10-02T03:00:00+00:00", "kind": "note"}) + "\n")
    assert pending_runs(runs) == [run_dir]


def test_unsuccessful_ok_false_reply_is_not_marked(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = _make_run(runs)
    report = sync_pending(_client(Api(sync_replies=[(200, {"ok": False})]), TOKEN), runs)
    assert report.synced == [] and not (run_dir / MARKER).exists()


# --- CLI sync and run auto-sync -------------------------------------------------------------------


def _login_file(api_url: str = API) -> None:
    save_credential(DeviceCredential(token=TOKEN, device_id="d1", api_url=api_url))


def test_cli_sync_requires_login(tmp_path) -> None:
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(tmp_path)])
    assert result.exit_code == 1 and "not signed in" in result.output


def test_cli_sync_exit_codes(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    _make_run(runs)
    _login_file()

    api = Api(sync_replies=[(503, {"error": "unavailable"})])
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0, result.output  # server trouble: queued, not a refusal
    assert "retry later" in result.output
    assert api.paths()[0] == "/api/v1/device/heartbeat"

    api = Api(sync_replies=[(403, {"error": "forbidden", "message": "plan limit"})])
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 1 and "refused" in result.output

    api = Api()
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0 and "synced 1 run" in result.output
    assert TOKEN not in result.output
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0 and "nothing to sync" in result.output


def test_cli_sync_refuses_to_send_a_saved_token_to_another_url(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    _make_run(runs)
    _login_file("https://app.aevrin.net/api/v1")
    monkeypatch.setenv("MODELWRECKER_CLOUD_URL", "https://other.example/api/v1")
    called: list = []
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: called.append(url))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 2 and "login" in result.output
    assert called == []


_CONFIG = (
    "project: {name: local-smoke-test}\n"
    "attacker: {protocol: openai_compatible, model: m, base_url: https://x.example}\n"
    "judge: {protocol: openai_compatible, model: m, base_url: https://x.example}\n"
    "target: {protocol: openai_compatible, model: llama3, base_url: https://x.example, "
    "authorized: true}\n"
    "objectives:\n  - {title: t0, category: system_prompt_leak}\n"
)


@pytest.fixture
def fake_engine(monkeypatch):
    """Replace the attack loop with one that writes a tiny run folder, so `run` needs no model."""
    from modelwrecker.attacker import loop

    async def fake_run_config(cfg, *, store=None, emit=None, run_id=None):
        store.event("run_meta", target_model="llama3", target_provider="openai_compatible",
                    run_id=run_id, target_type="chat", project_name="local-smoke-test")
        store.event("attempt", objective="t0", strategy="direct_jailbreak", payload="p",
                    response="r", outcome="refused", score=0, category="system_prompt_leak")
        return loop.RunResult(run_id=run_id, objectives_run=1)

    monkeypatch.setattr(loop, "run_config", fake_run_config)


def _run_cli(tmp_path, *extra) -> object:
    cfg = tmp_path / "cfg.yaml"
    cfg.write_text(_CONFIG, encoding="utf-8")
    return runner.invoke(cli.app, ["run", str(cfg), "--out-dir", str(tmp_path / "runs"), *extra])


@pytest.mark.parametrize("failure", [
    (500, {"error": "internal"}),
    (401, {"error": "unauthorized"}),
    httpx.ConnectError("offline"),
])
def test_run_still_exits_0_when_sync_fails(tmp_path, monkeypatch, fake_engine, failure) -> None:
    _login_file()
    api = Api(sync_replies=[failure])
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    result = _run_cli(tmp_path)
    assert result.exit_code == 0, result.output
    assert "sync failed" in result.output
    assert len(api.sync_bodies()) == 1  # it did try
    runs = pending_runs(tmp_path / "runs")
    assert len(runs) == 1 and (runs[0] / "report.md").exists()  # results kept and still queued


def test_run_still_exits_0_when_sync_crashes(tmp_path, monkeypatch, fake_engine) -> None:
    _login_file()

    def boom(url, tok):
        raise RuntimeError("unexpected")

    monkeypatch.setattr(cli, "_make_cloud_client", boom)
    result = _run_cli(tmp_path)
    assert result.exit_code == 0, result.output
    assert "sync failed" in result.output


def test_run_auto_syncs_when_logged_in(tmp_path, monkeypatch, fake_engine) -> None:
    _login_file()
    api = Api()
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    result = _run_cli(tmp_path)
    assert result.exit_code == 0, result.output
    assert len(api.sync_bodies()) == 1
    assert api.sync_bodies()[0]["run"]["campaign"]["name"] == "local-smoke-test"
    assert pending_runs(tmp_path / "runs") == []


def test_run_does_not_sync_with_no_sync_or_when_logged_out(tmp_path, monkeypatch,
                                                           fake_engine) -> None:
    api = Api()
    monkeypatch.setattr(cli, "_make_cloud_client", lambda url, tok: _client(api, tok))
    result = _run_cli(tmp_path)  # not signed in, default: silently skip
    assert result.exit_code == 0 and api.requests == []
    assert "not signed in" not in result.output and "sync failed" not in result.output

    result = _run_cli(tmp_path, "--sync")  # asked for explicitly while signed out: a note only
    assert result.exit_code == 0 and api.requests == []
    assert "not signed in" in result.output

    _login_file()
    result = _run_cli(tmp_path, "--no-sync")
    assert result.exit_code == 0 and api.requests == []
