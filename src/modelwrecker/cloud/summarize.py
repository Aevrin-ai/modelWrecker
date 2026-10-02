"""Build the `POST /sync` body from a finished run folder. Metadata only.

The body follows docs/architecture/control-plane-api.md field for field. Every value is picked by
name from the run's files; nothing is copied wholesale. It never includes an attack payload, a model
response or reasoning, a system prompt, an endpoint URL, an API key, tool arguments, or the attack
sequence.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from .. import __version__
from ..analytics.engine import compute_analytics
from ..findings.report import load_run, load_run_meta
from ..security.redaction import redact

SCHEMA_VERSION = 1

# The exact key sets from the contract. Tests compare against these.
BODY_KEYS = ("schema", "engine_version", "run")
RUN_KEYS = (
    "run_id", "campaign", "target", "started_at", "completed_at", "attempts", "successes",
    "partials", "refusals", "errors", "asr", "asr_ci_low", "asr_ci_high", "by_strategy", "findings",
)
CAMPAIGN_KEYS = ("external_id", "name")
TARGET_KEYS = ("name", "type", "model", "provider")
STRATEGY_KEYS = ("strategy", "attempts", "successes", "partials")
FINDING_KEYS = (
    "id", "title", "severity", "score", "strategy", "taxonomy", "replays", "successes",
    "success_rate", "ci_low", "ci_high", "confidence", "discovered_at",
)
TAXONOMY_KEYS = ("framework", "id")

_MAX_TEXT = 300  # cap user-authored labels (titles, names) so one long string cannot bloat the body


class NotARunError(ValueError):
    """The folder is not a finished run (it has no events.jsonl)."""


def build_sync_body(run_dir: str | Path, engine_version: str = __version__) -> dict:
    d = Path(run_dir)
    if not (d / "events.jsonl").is_file():
        raise NotARunError(f"not a run folder: {d}")

    findings, attempts = load_run(d)
    meta = load_run_meta(d)
    events = _read_events(d / "events.jsonl")
    analytics = compute_analytics(findings, attempts)
    started, completed = _time_bounds(d / "events.jsonl", events, meta)
    run_id = str(meta.get("run_id") or d.name)

    project = _text(meta.get("project_name"))
    campaign_name = project or run_id
    model = _text(meta.get("target_model")) or _evidence_model(d) or "unknown"
    asr_low, asr_high = analytics.asr_ci

    run = {
        "run_id": run_id,
        "campaign": {"external_id": campaign_name, "name": campaign_name},
        "target": {
            "name": model,
            "type": _text(meta.get("target_type")) or "chat",
            "model": model,
            "provider": _text(meta.get("target_provider")) or "unknown",
        },
        "started_at": started,
        "completed_at": completed,
        "attempts": analytics.total_attempts,
        "successes": analytics.successes,
        "partials": analytics.partials,
        "refusals": analytics.refusals,
        "errors": analytics.errors,
        "asr": _rate(analytics.asr),
        "asr_ci_low": _rate(asr_low),
        "asr_ci_high": _rate(asr_high),
        "by_strategy": [
            {"strategy": _text(b.key), "attempts": b.attempts, "successes": b.successes,
             "partials": b.partials}
            for b in analytics.by_strategy
        ],
        "findings": [_finding(d, f, _finding_strategy(f, events, attempts)) for f in findings],
    }
    # Defense in depth: scrub anything secret-shaped that slipped into a user-authored label.
    return redact({"schema": SCHEMA_VERSION, "engine_version": engine_version, "run": run})


def _finding(run_dir: Path, f, strategy: str) -> dict:
    ev = _read_evidence(run_dir, f.evidence_id)
    rel = ev.get("reliability") or {}
    judge = ev.get("judge_result") or {}
    return {
        "id": f.id,
        "title": _text(f.title),
        "severity": f.severity.value,
        "score": _int(judge.get("score"), 0, 10),
        "strategy": _text(strategy) or "unknown",
        "taxonomy": [{"framework": t.framework, "id": t.id} for t in f.taxonomy],
        "replays": _int(rel.get("attempts_run"), 0),
        "successes": _int(rel.get("successes"), 0),
        "success_rate": _rate(rel.get("success_rate")),
        "ci_low": _rate(rel.get("ci_low")),
        "ci_high": _rate(rel.get("ci_high")),
        "confidence": _text(rel.get("confidence")) or "does_not_hold",
        "discovered_at": _iso(f.created_at),
    }


def _finding_strategy(f, events: list[dict], attempts: list[dict]) -> str:
    """The strategy name that produced a finding.

    The `finding` event records it. Runs written before that field existed fall back to the last
    successful attempt for the same objective. (Evidence `strategy` holds the plan id, not a name.)
    """
    for e in events:
        if e.get("kind") == "finding" and e.get("id") == f.id and e.get("strategy"):
            return str(e["strategy"])
    for a in reversed(attempts):
        if a.get("objective") == f.title and a.get("outcome") == "success" and a.get("strategy"):
            return str(a["strategy"])
    return ""


def _read_events(path: Path) -> list[dict]:
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if isinstance(e, dict):
            out.append(e)
    return out


def _read_evidence(run_dir: Path, evidence_id: str) -> dict:
    """Load one evidence file. Callers pick named fields only; the dict never leaves this module."""
    if not evidence_id or "/" in evidence_id or "\\" in evidence_id or ".." in evidence_id:
        return {}
    p = run_dir / f"evidence-{evidence_id}.json"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _evidence_model(run_dir: Path) -> str:
    """Fallback for runs written before run_meta existed: the target model name from evidence."""
    for p in sorted(run_dir.glob("evidence-*.json")):
        try:
            model = (json.loads(p.read_text(encoding="utf-8")).get("model") or {}).get("model")
        except (OSError, ValueError, AttributeError):
            continue
        if model:
            return _text(model)
    return ""


def _time_bounds(events_path: Path, events: list[dict], meta: dict) -> tuple[str, str]:
    stamps = [p for p in (_parse(e.get("ts")) for e in events) if p is not None]
    started = _parse(meta.get("ts")) or (min(stamps) if stamps else None)
    if started is None:
        started = datetime.fromtimestamp(events_path.stat().st_mtime, tz=UTC)
    completed = max(stamps) if stamps else started
    return _iso(started), _iso(completed)


def _parse(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _rate(value: object) -> float:
    try:
        v = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    return round(min(1.0, max(0.0, v)), 4)


def _int(value: object, low: int, high: int | None = None) -> int:
    try:
        v = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return low
    v = max(low, v)
    return min(high, v) if high is not None else v


def _text(value: object) -> str:
    if value is None:
        return ""
    return str(value)[:_MAX_TEXT]
