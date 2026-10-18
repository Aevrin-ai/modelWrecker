"""Build the `POST /sync` body from a finished run folder.

The body follows docs/architecture/control-plane-api.md field for field. Every value is picked by
name from the run's files; nothing is copied wholesale.

By default it is metadata only: it never includes an attack payload, a model response or reasoning,
a system prompt, tool arguments, or the attack sequence. Only when the account turned detail on in
the dashboard (a `SyncPolicy`) does it add, per finding, the prompt sent, the model reply, and the
judge verdict (`evidence_detail`), and per run, every attempt. Detail is redacted, capped per field,
and capped in total so the body stays under the API's limit. An endpoint URL, an API key, and
the run's configuration are never included in any mode.
"""

from __future__ import annotations

from pathlib import Path

from .. import __version__
from ..analytics.engine import Analytics, compute_analytics
from ..data import Finding
from ..findings.report import load_run, load_run_meta
from ..security.redaction import redact
from .evidence_detail import EVIDENCE_KEYS as EVIDENCE_KEYS
from .evidence_detail import EVIDENCE_TEXT_MAX as EVIDENCE_TEXT_MAX
from .evidence_detail import TRANSCRIPT_TEXT_MAX, evidence_detail
from .policy import METADATA_ONLY, SyncPolicy
from .run_files import evidence_model, finding_strategy, read_events, time_bounds
from .run_files import read_evidence as _read_evidence
from .summary_values import (
    MAX_TEXT,
    body_text,
    bounded_int,
    iso_time,
    json_size,
    label,
    parse_time,
    rate,
    short_text,
)

SCHEMA_VERSION = 1

# the totals keep a body under the 4 MB sync cap even when every character is JSON-escaped
MAX_ATTEMPTS = 2_000
EVIDENCE_BUDGET = 1_200_000  # bytes of JSON across all findings' evidence
TRANSCRIPT_BUDGET = 1_800_000  # bytes of JSON across one run's attempts

ATTEMPT_KEYS = ("at", "objective", "category", "strategy", "outcome", "score", "payload",
                "response")


class NotARunError(ValueError):
    """The folder is not a finished run (it has no events.jsonl)."""


def build_sync_body(run_dir: str | Path, engine_version: str = __version__,
                    policy: SyncPolicy = METADATA_ONLY) -> dict:
    """The sync body for one run folder: metadata always, detail only as `policy` allows."""
    run_path = Path(run_dir)
    if not (run_path / "events.jsonl").is_file():
        raise NotARunError(f"not a run folder: {run_path}")

    findings, attempts = load_run(run_path)
    run = _run_summary(run_path, findings, attempts)
    if policy.evidence:
        _attach_evidence(run_path, findings, run["findings"], policy.transcripts)
    if policy.transcripts:
        run["transcript"] = _transcript(attempts)
    # defense in depth: scrub anything secret-shaped that slipped into a user-authored label
    return redact({"schema": SCHEMA_VERSION, "engine_version": engine_version, "run": run})


def _run_summary(run_path: Path, findings: list[Finding], attempts: list[dict]) -> dict:
    meta = load_run_meta(run_path)
    events = read_events(run_path / "events.jsonl")
    analytics = compute_analytics(findings, attempts)
    started, completed = time_bounds(run_path / "events.jsonl", events, meta)
    run_id = str(meta.get("run_id") or run_path.name)
    campaign_name = short_text(meta.get("project_name")) or run_id
    model = short_text(meta.get("target_model")) or evidence_model(run_path) or "unknown"
    return {
        "run_id": run_id,
        "campaign": {"external_id": campaign_name, "name": campaign_name},
        "target": {
            "name": model,
            "type": short_text(meta.get("target_type")) or "chat",
            "model": model,
            "provider": short_text(meta.get("target_provider")) or "unknown",
        },
        "started_at": started,
        "completed_at": completed,
        **_outcome_counts(analytics),
        "findings": [_finding(run_path, finding, finding_strategy(finding, events, attempts))
                     for finding in findings],
    }


def _outcome_counts(analytics: Analytics) -> dict:
    asr_low, asr_high = analytics.asr_ci
    return {
        "attempts": analytics.total_attempts,
        "successes": analytics.successes,
        "partials": analytics.partials,
        "refusals": analytics.refusals,
        "errors": analytics.errors,
        "asr": rate(analytics.asr),
        "asr_ci_low": rate(asr_low),
        "asr_ci_high": rate(asr_high),
        "by_strategy": [
            {"strategy": short_text(row.key), "attempts": row.attempts,
             "successes": row.successes, "partials": row.partials}
            for row in analytics.by_strategy
        ],
    }


def _attach_evidence(run_path: Path, findings: list[Finding], summaries: list[dict],
                     with_conversation: bool) -> None:
    """Add evidence to each finding summary while the total stays under EVIDENCE_BUDGET."""
    budget = EVIDENCE_BUDGET
    for finding, summary in zip(findings, summaries, strict=True):
        detail = evidence_detail(run_path, finding, summary["strategy"],
                                 with_conversation=with_conversation)
        if detail is None:
            # no evidence file: the finding stays metadata only
            continue
        size = json_size(detail)
        if size > budget:
            # over the total cap: this one stays local (the rest may still fit)
            continue
        budget -= size
        summary["evidence"] = detail


def _transcript(attempts: list[dict]) -> dict:
    """Every attempt in run order, up to the count and size caps. `truncated` marks a cut list."""
    items: list[dict] = []
    used = 0
    truncated = False
    for attempt in attempts:
        item = _transcript_item(attempt)
        size = json_size(item)
        if len(items) >= MAX_ATTEMPTS or used + size > TRANSCRIPT_BUDGET:
            truncated = True
            break
        items.append(item)
        used += size
    return {"attempts": items, "truncated": truncated}


def _transcript_item(attempt: dict) -> dict:
    moment = parse_time(attempt.get("ts"))
    return {
        "at": iso_time(moment) if moment else None,
        "objective": label(attempt.get("objective"), MAX_TEXT),
        "category": label(attempt.get("category"), 80),
        "strategy": label(attempt.get("strategy"), 80),
        "outcome": label(attempt.get("outcome"), 40),
        "score": bounded_int(attempt.get("score"), 0, 10),
        "payload": body_text(attempt.get("payload"), TRANSCRIPT_TEXT_MAX),
        "response": body_text(attempt.get("response"), TRANSCRIPT_TEXT_MAX),
    }


def _finding(run_dir: Path, finding: Finding, strategy: str) -> dict:
    evidence = _read_evidence(run_dir, finding.evidence_id)
    reliability = evidence.get("reliability") or {}
    judge = evidence.get("judge_result") or {}
    return {
        "id": finding.id,
        "title": short_text(finding.title),
        "severity": finding.severity.value,
        "score": bounded_int(judge.get("score"), 0, 10),
        "strategy": short_text(strategy) or "unknown",
        "taxonomy": [{"framework": ref.framework, "id": ref.id} for ref in finding.taxonomy],
        "replays": bounded_int(reliability.get("attempts_run"), 0),
        "successes": bounded_int(reliability.get("successes"), 0),
        "success_rate": rate(reliability.get("success_rate")),
        "ci_low": rate(reliability.get("ci_low")),
        "ci_high": rate(reliability.get("ci_high")),
        "confidence": short_text(reliability.get("confidence")) or "does_not_hold",
        "discovered_at": iso_time(finding.created_at),
    }
