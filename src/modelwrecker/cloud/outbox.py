"""Offline-safe outbox for result sync (ROADMAP 10.9).

A run folder is pending until a `.synced.json` marker exists in it. The marker is written only after
the cloud API answers `200` with `ok: true`, so a dropped connection, a server error, or a refusal
leaves the run pending and the next `modelwrecker sync` retries it. Re-sending is safe because the
API upserts by run id. The marker also records the size of `events.jsonl`; if the run grows after
it was synced (it was still running), it becomes pending again.

The marker also records which detail (evidence, transcripts) the run was synced with. When the
account turns detail on later, runs synced without it become pending again, so a plain
`modelwrecker sync` back-fills the detail for old runs (issue #28).
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from .client import CloudClient, CloudError
from .policy import METADATA_ONLY, SyncPolicy
from .summarize import build_sync_body

MARKER = ".synced.json"


def is_run_dir(d: Path) -> bool:
    return d.is_dir() and (d / "events.jsonl").is_file()


def _read_marker(d: Path) -> dict | None:
    marker = d / MARKER
    if not marker.is_file():
        return None
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None  # a damaged marker means "send again"; the API upserts, so this is safe
    return data if isinstance(data, dict) else None


def is_synced(d: Path, policy: SyncPolicy = METADATA_ONLY) -> bool:
    """True when the cloud already has this run with at least the detail `policy` asks for."""
    data = _read_marker(d)
    if data is None:
        return False
    recorded = data.get("events_size")
    if recorded is not None and recorded != _events_size(d):
        return False
    detail = data.get("detail") if isinstance(data.get("detail"), dict) else {}
    if policy.evidence and detail.get("evidence") is not True:
        return False
    return not (policy.transcripts and detail.get("transcripts") is not True)


def pending_runs(
    runs_dir: str | Path, policy: SyncPolicy = METADATA_ONLY, *, resync: bool = False
) -> list[Path]:
    """Every finished run under `runs_dir` the cloud does not have yet (in the detail `policy`
    asks for), oldest first. `resync` returns every run."""
    base = Path(runs_dir)
    if not base.is_dir():
        return []
    return [d for d in sorted(base.iterdir())
            if is_run_dir(d) and (resync or not is_synced(d, policy))]


@dataclass(frozen=True)
class RunPreview:
    """One pending run as `sync` lists it before sending: what the summary says, nothing more."""

    name: str
    target: str = ""
    attempts: int = 0
    findings: int = 0
    started_at: str = ""
    problem: str | None = None  # set when the run cannot be summarized; sync reports and skips it


def preview_run(d: Path) -> RunPreview:
    """Build the same summary `sync_run` would send and describe it. Sends nothing."""
    try:
        run = build_sync_body(d)["run"]
    except (ValueError, OSError) as e:
        return RunPreview(d.name, problem=f"unreadable run: {type(e).__name__}")
    target = run["target"]
    return RunPreview(
        name=d.name,
        target=f"{target['model']} via {target['provider']}",
        attempts=run["attempts"],
        findings=len(run["findings"]),
        started_at=run["started_at"],
    )


def mark_synced(d: Path, response: dict, sent: SyncPolicy = METADATA_ONLY) -> Path:
    """Write the marker. Call this only with the body of a 200 response.

    `detail` records the detail that was both sent and allowed by the account, so a run synced while
    detail was off (or with --metadata-only) is sent again once detail is on.
    """
    allowed = response.get("detail") if isinstance(response.get("detail"), dict) else {}
    record = {
        "campaign_id": response.get("campaign_id"),
        "run_id": response.get("run_id"),
        "findings": response.get("findings"),
        "synced_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "events_size": _events_size(d),
        "detail": {
            "evidence": sent.evidence and allowed.get("evidence") is True,
            "transcripts": sent.transcripts and allowed.get("transcripts") is True,
        },
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


def sync_run(client: CloudClient, d: Path, policy: SyncPolicy = METADATA_ONLY) -> dict:
    """Summarize and push one run. Marks it synced on success. Raises CloudError on failure."""
    body = build_sync_body(d, policy=policy)
    response = client.sync(body)
    mark_synced(d, response, sent=policy)
    return response


@dataclass
class SyncReport:
    synced: list[str] = field(default_factory=list)
    deferred: list[tuple[str, str]] = field(default_factory=list)  # network, 5xx, 429: retry later
    refused: list[tuple[str, str]] = field(default_factory=list)  # the API said no (4xx)

    @property
    def ok(self) -> bool:
        return not self.refused


def sync_pending(
    client: CloudClient,
    runs_dir: str | Path,
    policy: SyncPolicy = METADATA_ONLY,
    *,
    resync: bool = False,
) -> SyncReport:
    """Push every pending run. One failed run does not stop the others."""
    report = SyncReport()
    todo = pending_runs(runs_dir, policy, resync=resync)
    for i, d in enumerate(todo):
        try:
            sync_run(client, d, policy)
        except CloudError as e:
            bucket = report.refused if e.refused else report.deferred
            bucket.append((d.name, f"{e.code}: {e.message}"))
            if e.code in ("network_error", "timeout"):
                # The cloud is unreachable: stop early, everything stays queued for next time.
                for rest in todo[i + 1:]:
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
