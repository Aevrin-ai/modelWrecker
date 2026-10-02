"""Offline-safe outbox for result sync (ROADMAP 10.9).

A run folder is pending until a `.synced.json` marker exists in it. The marker is written only after
the cloud API answers `200` with `ok: true`, so a dropped connection, a server error, or a refusal
leaves the run pending and the next `modelwrecker sync` retries it. Re-sending is safe because the
API upserts by run id. The marker also records the size of `events.jsonl`; if the run grows after
it was synced (it was still running), it becomes pending again.
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from .client import CloudClient, CloudError
from .summarize import build_sync_body

MARKER = ".synced.json"


def is_run_dir(d: Path) -> bool:
    return d.is_dir() and (d / "events.jsonl").is_file()


def is_synced(d: Path) -> bool:
    marker = d / MARKER
    if not marker.is_file():
        return False
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False  # a damaged marker means "send again"; the API upserts, so this is safe
    recorded = data.get("events_size") if isinstance(data, dict) else None
    if recorded is None:
        return True
    return recorded == _events_size(d)


def pending_runs(runs_dir: str | Path) -> list[Path]:
    """Every finished run under `runs_dir` that has not been confirmed by the API, oldest first."""
    base = Path(runs_dir)
    if not base.is_dir():
        return []
    return [d for d in sorted(base.iterdir()) if is_run_dir(d) and not is_synced(d)]


def mark_synced(d: Path, response: dict) -> Path:
    """Write the marker. Call this only with the body of a 200 response."""
    record = {
        "campaign_id": response.get("campaign_id"),
        "run_id": response.get("run_id"),
        "findings": response.get("findings"),
        "synced_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "events_size": _events_size(d),
    }
    path = d / MARKER
    fd, tmp = tempfile.mkstemp(dir=str(d), prefix=".synced-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(json.dumps(record, indent=2))
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return path


def sync_run(client: CloudClient, d: Path) -> dict:
    """Summarize and push one run. Marks it synced on success. Raises CloudError on failure."""
    body = build_sync_body(d)
    response = client.sync(body)
    mark_synced(d, response)
    return response


@dataclass
class SyncReport:
    synced: list[str] = field(default_factory=list)
    deferred: list[tuple[str, str]] = field(default_factory=list)  # network, 5xx, 429: retry later
    refused: list[tuple[str, str]] = field(default_factory=list)  # the API said no (4xx)

    @property
    def ok(self) -> bool:
        return not self.refused


def sync_pending(client: CloudClient, runs_dir: str | Path) -> SyncReport:
    """Push every pending run. One failed run does not stop the others."""
    report = SyncReport()
    for d in pending_runs(runs_dir):
        try:
            sync_run(client, d)
        except CloudError as e:
            bucket = report.refused if e.refused else report.deferred
            bucket.append((d.name, f"{e.code}: {e.message}"))
            if e.code in ("network_error", "timeout"):
                # The cloud is unreachable: stop early, everything stays queued for next time.
                for rest in pending_runs(runs_dir):
                    if rest.name not in {n for n, _ in report.deferred}:
                        report.deferred.append((rest.name, "not attempted: cloud unreachable"))
                break
            continue
        except ValueError as e:  # not a readable run; leave it alone and report it
            report.deferred.append((d.name, f"unreadable run: {type(e).__name__}"))
            continue
        report.synced.append(d.name)
    return report


def _events_size(d: Path) -> int:
    try:
        return (d / "events.jsonl").stat().st_size
    except OSError:
        return -1
