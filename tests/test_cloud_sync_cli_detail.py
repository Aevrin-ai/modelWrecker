"""The `sync` command follows the dashboard's detail settings, and `--metadata-only` overrides them.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in
a temporary folder (see conftest.py).
"""

from __future__ import annotations

from cloud_fakes import (
    BOTH_ON,
    SECRET,
    TOKEN,
    Api,
    assert_private,
    client_for,
    detail_reply,
    login_file,
    make_run,
)
from typer.testing import CliRunner

from modelwrecker import cli
from modelwrecker.cli import cloud_session
from modelwrecker.cloud import pending_runs, sync_pending

runner = CliRunner()


def test_cli_sync_follows_the_dashboard_settings(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    make_run(runs)
    login_file()
    on = {"ok": True, "sync": {"metadata": True, "evidence": True, "transcripts": True}}
    api = Api(heartbeat=(200, on), sync_replies=[detail_reply(True, True)])
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0, result.output
    assert "metadata + evidence + transcripts" in result.output
    assert "secrets are redacted" in result.output
    sent = api.sync_bodies()[0]["run"]
    assert sent["findings"][0]["evidence"]["payload"] == f"{SECRET}-evidence-payload"
    assert len(sent["transcript"]["attempts"]) == 4
    assert SECRET not in result.output  # the listing never shows run content
    assert pending_runs(runs, BOTH_ON) == []


def test_cli_sync_back_fills_and_metadata_only_overrides(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)
    login_file()
    sync_pending(client_for(Api(), TOKEN), runs)  # synced earlier, metadata only

    on = (200, {"ok": True, "sync": {"evidence": True, "transcripts": False}})
    api = Api(heartbeat=on)
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs), "--metadata-only"])
    assert result.exit_code == 0 and "nothing to sync" in result.output
    assert api.sync_bodies() == []

    api = Api(heartbeat=on, sync_replies=[detail_reply(True, False)])
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0, result.output
    assert run_dir.name in result.output and "[synced before, sending again]" in result.output
    assert "evidence" in api.sync_bodies()[0]["run"]["findings"][0]


def test_cli_sync_sends_metadata_when_settings_cannot_be_read(tmp_path, monkeypatch) -> None:
    runs = tmp_path / "runs"
    make_run(runs)
    login_file()
    api = Api(heartbeat=(500, {"error": "internal"}))
    monkeypatch.setattr(cloud_session, "_make_cloud_client", lambda url, tok: client_for(api, tok))
    result = runner.invoke(cli.app, ["sync", "--runs-dir", str(runs)])
    assert result.exit_code == 0, result.output
    assert "only summary" in result.output
    assert_private(api.sync_bodies()[0])
