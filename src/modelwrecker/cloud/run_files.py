"""Read the files of a finished run folder, and what they say, for the sync summary.

Callers pick named fields from what these return; a whole file never goes into the sync body.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from ..data import Finding
from .summary_values import iso_time, parse_time, short_text


def read_events(path: Path) -> list[dict]:
    """Every JSON object line of events.jsonl; a broken line is skipped."""
    events: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if isinstance(event, dict):
            events.append(event)
    return events


def read_evidence(run_dir: Path, evidence_id: str) -> dict:
    """Load one evidence file. Callers pick named fields only; the dict never leaves the summary."""
    if not evidence_id or "/" in evidence_id or "\\" in evidence_id or ".." in evidence_id:
        return {}
    evidence_path = run_dir / f"evidence-{evidence_id}.json"
    try:
        data = json.loads(evidence_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def evidence_model(run_dir: Path) -> str:
    """Fallback for runs written before run_meta existed: the target model name from evidence."""
    for evidence_path in sorted(run_dir.glob("evidence-*.json")):
        try:
            data = json.loads(evidence_path.read_text(encoding="utf-8"))
            model = (data.get("model") or {}).get("model")
        except (OSError, ValueError, AttributeError):
            continue
        if model:
            return short_text(model)
    return ""


def time_bounds(events_path: Path, events: list[dict], meta: dict) -> tuple[str, str]:
    """When the run started and finished, from run_meta and the event times."""
    stamps = [moment for moment in (parse_time(e.get("ts")) for e in events) if moment is not None]
    started = parse_time(meta.get("ts")) or (min(stamps) if stamps else None)
    if started is None:
        started = datetime.fromtimestamp(events_path.stat().st_mtime, tz=UTC)
    completed = max(stamps) if stamps else started
    return iso_time(started), iso_time(completed)


def finding_strategy(finding: Finding, events: list[dict], attempts: list[dict]) -> str:
    """The strategy name that produced a finding.

    The `finding` event records it. Runs written before that field existed fall back to the last
    successful attempt for the same objective. (Evidence `strategy` holds the plan id, not a name.)
    """
    for event in events:
        if event.get("kind") == "finding" and event.get("id") == finding.id \
                and event.get("strategy"):
            return str(event["strategy"])
    for attempt in reversed(attempts):
        if attempt.get("objective") == finding.title and attempt.get("outcome") == "success" \
                and attempt.get("strategy"):
            return str(attempt["strategy"])
    return ""
