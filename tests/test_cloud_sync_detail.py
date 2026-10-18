"""Opt-in sync detail: evidence and transcripts, sent only when the dashboard turns them on.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in
a temporary folder (see conftest.py).
"""

from __future__ import annotations

import json

from cloud_fakes import (
    BOTH_ON,
    EVIDENCE_ON,
    SECRET,
    TOKEN,
    TRANSCRIPTS_ON,
    Api,
    assert_private,
    client_for,
    detail_reply,
    make_run,
)

from modelwrecker.cloud import (
    MARKER,
    SyncPolicy,
    build_sync_body,
    pending_runs,
    summarize,
    sync_pending,
)

NEVER_SENT = ("base-url", "provider-url", "config-url", "system-prompt", "strategy-params",
              "repro-steps", "finding-summary", "objective-description")


def test_evidence_has_only_the_allowed_fields_and_never_the_configuration(tmp_path) -> None:
    run_dir = make_run(tmp_path / "runs")
    body = build_sync_body(run_dir, policy=EVIDENCE_ON)
    ev = body["run"]["findings"][0]["evidence"]
    assert tuple(ev) == summarize.EVIDENCE_KEYS
    assert ev["payload"] == f"{SECRET}-evidence-payload"
    assert ev["response"] == f"{SECRET}-evidence-response"
    assert ev["strategy"] == "crescendo"  # the name, not the plan id
    assert ev["judge"]["rationale"] == f"{SECRET}-judge-rationale" and ev["judge"]["score"] == 9
    args = json.dumps({"cmd": f"{SECRET}-tool-args"})
    assert ev["tool_calls"] == [{"name": "shell", "args": args}]
    assert ev["conversation"] == []  # multi-turn conversations follow the transcripts setting
    assert "transcript" not in body["run"]
    text = json.dumps(body)
    for part in NEVER_SENT:
        assert f"{SECRET}-{part}" not in text, part
    for banned in ("base_url", "configuration", "api_key", "system", "provider_url"):
        assert f'"{banned}":' not in text, banned


def test_transcript_lists_every_attempt_and_brings_the_conversation_with_evidence(tmp_path) -> None:
    run_dir = make_run(tmp_path / "runs")
    body = build_sync_body(run_dir, policy=TRANSCRIPTS_ON)
    transcript = body["run"]["transcript"]
    assert transcript["truncated"] is False and len(transcript["attempts"]) == 4
    first = transcript["attempts"][0]
    assert tuple(first) == summarize.ATTEMPT_KEYS
    assert first["payload"] == f"{SECRET}-event-payload" and first["outcome"] == "success"
    assert first["at"].endswith("Z")
    assert "evidence" not in body["run"]["findings"][0]

    both = build_sync_body(run_dir, policy=BOTH_ON)
    assert both["run"]["findings"][0]["evidence"]["conversation"] == [
        {"role": "user", "text": f"{SECRET}-attack-sequence"}]


def test_metadata_only_body_is_unchanged(tmp_path) -> None:
    run_dir = make_run(tmp_path / "runs")
    assert_private(build_sync_body(run_dir))
    assert_private(build_sync_body(run_dir, policy=SyncPolicy()))


def test_detail_is_redacted_before_it_is_capped(tmp_path) -> None:
    run_dir = make_run(tmp_path / "runs")
    ev_path = next(run_dir.glob("evidence-*.json"))
    ev = json.loads(ev_path.read_text(encoding="utf-8"))
    key = "sk-" + "a" * 30
    ev["target_response"] = f"leaked {key} " + "x" * 30_000
    ev_path.write_text(json.dumps(ev), encoding="utf-8")
    bearer_token = "Bearer " + "t" * 20
    with open(run_dir / "events.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": "2026-10-02T03:00:00+00:00", "kind": "attempt", "objective": "o",
                            "strategy": "s", "payload": bearer_token + " " + "p" * 9_000,
                            "response": "r", "outcome": "refused", "score": 0}) + "\n")
    body = build_sync_body(run_dir, policy=BOTH_ON)
    response = body["run"]["findings"][0]["evidence"]["response"]
    assert key not in response and "[REDACTED]" in response
    assert len(response) == summarize.EVIDENCE_TEXT_MAX
    last = body["run"]["transcript"]["attempts"][-1]
    assert "t" * 20 not in last["payload"] and len(last["payload"]) == summarize.TRANSCRIPT_TEXT_MAX


def test_transcript_stops_at_the_size_budget(tmp_path, monkeypatch) -> None:
    run_dir = make_run(tmp_path / "runs")
    monkeypatch.setattr(summarize, "TRANSCRIPT_BUDGET", 700)
    transcript = build_sync_body(run_dir, policy=TRANSCRIPTS_ON)["run"]["transcript"]
    assert transcript["truncated"] is True and 0 < len(transcript["attempts"]) < 4


def test_runs_synced_without_detail_are_sent_again_once_detail_is_on(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)
    sync_pending(client_for(Api(), TOKEN), runs)  # metadata only, old-style reply without `detail`
    assert pending_runs(runs) == []
    assert pending_runs(runs, EVIDENCE_ON) == [run_dir]  # back-fill
    assert pending_runs(runs, TRANSCRIPTS_ON) == [run_dir]

    api = Api(sync_replies=[detail_reply(True, True)])
    report = sync_pending(client_for(api, TOKEN), runs, BOTH_ON)
    assert report.synced == [run_dir.name]
    sent = api.sync_bodies()[0]["run"]
    assert "evidence" in sent["findings"][0] and "transcript" in sent
    assert pending_runs(runs, BOTH_ON) == []
    marker = json.loads((run_dir / MARKER).read_text(encoding="utf-8"))
    assert marker["detail"] == {"evidence": True, "transcripts": True}


def test_detail_the_server_did_not_keep_stays_pending(tmp_path) -> None:
    runs = tmp_path / "runs"
    run_dir = make_run(runs)
    # The setting was turned off between the heartbeat and the sync: the server kept metadata only.
    sync_pending(client_for(Api(sync_replies=[detail_reply(False, False)]), TOKEN), runs, BOTH_ON)
    assert pending_runs(runs) == [] and pending_runs(runs, BOTH_ON) == [run_dir]


def test_resync_sends_every_run_again(tmp_path) -> None:
    runs = tmp_path / "runs"
    a = make_run(runs, run_id="20261002-000001-aaaaaaaa")
    b = make_run(runs, run_id="20261002-000002-bbbbbbbb")
    sync_pending(client_for(Api(), TOKEN), runs)
    assert pending_runs(runs) == [] and pending_runs(runs, resync=True) == [a, b]
    api = Api()
    assert sync_pending(client_for(api, TOKEN), runs, resync=True).synced == [a.name, b.name]
    assert len(api.sync_bodies()) == 2
