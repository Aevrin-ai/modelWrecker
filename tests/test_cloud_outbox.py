"""The outbox: which runs are pending, and when a run is marked synced.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in
a temporary folder (see conftest.py).
"""

from __future__ import annotations

import json

import httpx
from cloud_fakes import TOKEN, Api, assert_private, client_for, make_run, ok_reply

from modelwrecker.cloud import MARKER, pending_runs, sync_pending


def test_outbox_marks_synced_only_after_200_and_retries_after_500(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)
    assert pending_runs(runs) == [run_dir]

    api = Api(sync_replies=[(500, {"error": "internal", "message": "db down"})])
    report = sync_pending(client_for(api, TOKEN), runs)
    assert report.synced == [] and len(report.deferred) == 1 and report.ok
    assert not (run_dir / MARKER).exists()
    assert pending_runs(runs) == [run_dir]  # still queued

    api2 = Api(sync_replies=[(200, ok_reply())])
    report = sync_pending(client_for(api2, TOKEN), runs)
    assert report.synced == [run_dir.name]
    marker = json.loads((run_dir / MARKER).read_text(encoding="utf-8"))
    assert marker["campaign_id"] == "c-uuid" and marker["run_id"] == "r-uuid"
    assert marker["synced_at"].endswith("Z")
    assert pending_runs(runs) == []
    req = api2.requests[0]
    assert req.headers["authorization"] == f"Bearer {TOKEN}"
    assert_private(json.loads(req.content))


def test_outbox_refusal_and_network_failure_keep_runs_queued(tmp_path) -> None:
    runs = tmp_path / "runs"
    a = make_run(runs, run_id="20261002-000001-aaaaaaaa")
    b = make_run(runs, run_id="20261002-000002-bbbbbbbb")

    api = Api(sync_replies=[(401, {"error": "unauthorized", "message": "revoked"}),
                            (200, ok_reply())])
    report = sync_pending(client_for(api, TOKEN), runs)
    assert [n for n, _ in report.refused] == [a.name] and report.synced == [b.name]
    assert not report.ok and pending_runs(runs) == [a]

    api2 = Api(sync_replies=[httpx.ConnectError("offline")])
    report = sync_pending(client_for(api2, TOKEN), runs)
    assert report.ok and [n for n, _ in report.deferred] == [a.name]
    assert pending_runs(runs) == [a]


def test_a_run_that_grows_after_sync_is_pending_again(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)
    sync_pending(client_for(Api(), TOKEN), runs)
    assert pending_runs(runs) == []
    with open(run_dir / "events.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": "2026-10-02T03:00:00+00:00", "kind": "note"}) + "\n")
    assert pending_runs(runs) == [run_dir]


def test_unsuccessful_ok_false_reply_is_not_marked(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)
    report = sync_pending(client_for(Api(sync_replies=[(200, {"ok": False})]), TOKEN), runs)
    assert report.synced == [] and not (run_dir / MARKER).exists()
