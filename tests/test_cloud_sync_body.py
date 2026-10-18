"""The metadata-only sync body: exact contract keys, values, and the privacy check.

The privacy tests plant a secret in every sensitive place of a run folder and assert the
sync body carries none of it; a calibration test proves the check catches a leaky
summarizer.

Everything runs offline: HTTP goes through httpx.MockTransport and every credential lives in
a temporary folder (see conftest.py).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from cloud_fakes import RUN_ID, SECRET, assert_private, make_run

from modelwrecker.cloud import build_sync_body, summarize
from modelwrecker.data import Finding


def test_sync_body_matches_the_contract_keys_exactly(tmp_path) -> None:
    body = build_sync_body(make_run(tmp_path))
    # literal key sets from the API contract, so editing the module's constants cannot pass it
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
    body = build_sync_body(make_run(tmp_path), engine_version="0.0.1")
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
    run = build_sync_body(make_run(tmp_path, finding_strategy="many_shot"))["run"]
    assert run["findings"][0]["strategy"] == "many_shot"


def test_finding_strategy_falls_back_to_last_success_for_older_runs(tmp_path) -> None:
    run = build_sync_body(make_run(tmp_path, finding_strategy=None))["run"]
    assert run["findings"][0]["strategy"] == "crescendo"  # never the plan id in evidence


def test_campaign_falls_back_to_run_id_without_project_name(tmp_path) -> None:
    run = build_sync_body(make_run(tmp_path, project=None))["run"]
    assert run["campaign"] == {"external_id": RUN_ID, "name": RUN_ID}


def test_privacy_sync_body_carries_no_run_content(tmp_path) -> None:
    run_dir = make_run(tmp_path)
    # Calibration: the secret really is in the run folder, in every sensitive place.
    on_disk = "".join(p.read_text(encoding="utf-8") for p in run_dir.glob("*.json*"))
    for where in ("evidence-payload", "evidence-response", "event-payload", "event-response",
                  "system-prompt", "base-url", "config-url", "tool-args", "attack-sequence",
                  "reasoning"):
        assert f"{SECRET}-{where}" in on_disk, where
    body = build_sync_body(run_dir)
    assert_private(body)


def test_privacy_check_is_calibrated_against_a_leaky_summarizer(tmp_path, monkeypatch) -> None:
    """If summarize ever copies evidence.payload, even into an allowed field, the check fails."""
    run_dir = make_run(tmp_path)
    real = summarize._finding

    def leaky(folder: Path, finding: Finding, *rest: str) -> dict:
        out = real(folder, finding, *rest)
        out["title"] += summarize._read_evidence(folder, finding.evidence_id)["payload"]
        return out

    monkeypatch.setattr(summarize, "_finding", leaky)
    with pytest.raises(AssertionError):
        assert_private(build_sync_body(run_dir))
