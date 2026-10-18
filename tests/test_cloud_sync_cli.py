"""The `sync` command and the best-effort auto-sync after `run`.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in
a temporary folder (see conftest.py).
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from cloud_fakes import SECRET, TOKEN, Api, client_for, login_file, make_run
from typer.testing import CliRunner, Result

from modelwrecker import cli
from modelwrecker.cli import cloud_session
from modelwrecker.cloud import CloudClient, pending_runs, preview_run
from modelwrecker.cloud import outbox as outbox_mod
from modelwrecker.config import Config
from modelwrecker.storage.store import RunStore

runner = CliRunner()


def test_cli_sync_requires_login(tmp_path) -> None:
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(tmp_path)])
    assert result.exit_code == 1 and "not signed in" in result.output


def test_cli_sync_exit_codes(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    make_run(runs)
    login_file()

    api = Api(sync_replies=[(503, {"error": "unavailable"})])
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0, result.output  # server trouble: queued, not a refusal
    assert "retry later" in result.output
    assert api.paths()[0] == "/api/v1/device/heartbeat"

    api = Api(sync_replies=[(403, {"error": "forbidden", "message": "plan limit"})])
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 1 and "refused" in result.output

    api = Api()
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0 and "synced 1 run" in result.output
    assert TOKEN not in result.output
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0 and "nothing to sync" in result.output


def test_cli_sync_dry_run_lists_runs_and_sends_nothing(tmp_path, monkeypatch) -> None:
    # Issue #3: stray local runs were uploaded without the user seeing which ones.
    runs = tmp_path / "runs"
    a = make_run(runs, run_id="20261002-000001-aaaaaaaa")
    b = make_run(runs, run_id="20261002-000002-bbbbbbbb")
    called: list = []
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: called.append(url))

    # No sign-in needed, no client built, nothing marked synced.
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs), "--dry-run"])
    assert result.exit_code == 0, result.output
    assert called == []
    assert "2 run(s) would be sent" in result.output and "nothing was sent" in result.output
    assert a.name in result.output and b.name in result.output
    assert "finding(s)" in result.output and "evidence and transcripts stay" in result.output
    assert pending_runs(runs) == [a, b]
    assert SECRET not in result.output  # the preview shows the summary, never run content


def test_cli_sync_lists_runs_before_sending(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)
    login_file()
    api = Api()
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0, result.output
    listed, synced = result.output.index(run_dir.name), result.output.index("synced 1 run")
    assert "1 run(s) to send" in result.output and listed < synced


def test_preview_reports_an_unreadable_run_instead_of_crashing(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)

    def broken(_run_dir: Path) -> dict:
        raise ValueError("corrupt")

    monkeypatch.setattr(outbox_mod, "build_sync_body", broken)
    preview = preview_run(run_dir)
    assert preview.name == run_dir.name and preview.problem == "unreadable run: ValueError"


def test_cli_sync_refuses_to_send_a_saved_token_to_another_url(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    make_run(runs)
    login_file("https://app.aevrin.net/api/v1")
    monkeypatch.setenv("MODELWRECKER_CLOUD_URL", "https://other.example/api/v1")
    called: list = []
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: called.append(url))
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
def fake_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    """Replace the attack loop with one that writes a tiny run folder, so `run` needs no model."""
    from modelwrecker.attacker import loop

    async def fake_run_config(cfg: Config, *, store: RunStore | None = None,
                              emit: object = None, run_id: str | None = None,
                              allowance: object = None) -> loop.RunResult:
        store.event("run_meta", target_model="llama3", target_provider="openai_compatible",
                    run_id=run_id, target_type="chat", project_name="local-smoke-test")
        store.event("attempt", objective="t0", strategy="direct_jailbreak", payload="p",
                    response="r", outcome="refused", score=0, category="system_prompt_leak")
        return loop.RunResult(run_id=run_id, objectives_run=1)

    monkeypatch.setattr(loop, "run_config", fake_run_config)


def _run_cli(tmp_path: Path, *extra: str) -> Result:
    cfg = tmp_path / "cfg.yaml"
    cfg.write_text(_CONFIG, encoding="utf-8")
    return runner.invoke(cli.app, ["run", str(cfg), "--out-dir", str(tmp_path / "runs"), *extra])


@pytest.mark.parametrize("failure", [
    (500, {"error": "internal"}),
    (401, {"error": "unauthorized"}),
    httpx.ConnectError("offline"),
])
def test_run_still_exits_0_when_sync_fails(tmp_path, monkeypatch, fake_engine, failure) -> None:
    login_file()
    api = Api(sync_replies=[failure])
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = _run_cli(tmp_path)
    assert result.exit_code == 0, result.output
    assert "sync failed" in result.output
    assert len(api.sync_bodies()) == 1  # it did try
    runs = pending_runs(tmp_path / "runs")
    assert len(runs) == 1 and (runs[0] / "report.md").exists()  # results kept and still queued


def test_run_still_exits_0_when_sync_crashes(tmp_path, monkeypatch, fake_engine) -> None:
    login_file()

    def boom(url: str | None, tok: str | None) -> CloudClient:
        raise RuntimeError("unexpected")

    monkeypatch.setattr(cloud_session, "_make_cloud_client", boom)
    result = _run_cli(tmp_path)
    assert result.exit_code == 0, result.output
    assert "sync failed" in result.output


def test_run_auto_syncs_when_logged_in(tmp_path, monkeypatch, fake_engine) -> None:
    login_file()
    api = Api()
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = _run_cli(tmp_path)
    assert result.exit_code == 0, result.output
    assert len(api.sync_bodies()) == 1
    assert api.sync_bodies()[0]["run"]["campaign"]["name"] == "local-smoke-test"
    assert pending_runs(tmp_path / "runs") == []


def test_run_does_not_sync_with_no_sync_or_when_logged_out(tmp_path: Path, monkeypatch,
                                                           fake_engine) -> None:
    api = Api()
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = _run_cli(tmp_path)  # not signed in, default: silently skip
    assert result.exit_code == 0 and api.requests == []
    assert "not signed in" not in result.output and "sync failed" not in result.output

    result = _run_cli(tmp_path, "--sync")  # asked for explicitly while signed out: a note only
    assert result.exit_code == 0 and api.requests == []
    assert "not signed in" in result.output

    login_file()
    result = _run_cli(tmp_path, "--no-sync")
    assert result.exit_code == 0 and api.requests == []
