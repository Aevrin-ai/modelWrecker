"""Run storage: append-only JSONL event log + a SQLite index for findings.

Atomic writes; the index is rebuildable from the JSONL (see docs/decisions/ADR-0011-storage.md).
Artifacts can contain harmful content and redacted secrets, so files are written with tight
permissions and live under a gitignored runs dir.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from ..data import Evidence, Finding
from ..security.redaction import redact
from .files import atomic_write, chmod_quiet


class RunStore:
    def __init__(self, run_id: str, base_dir: str | Path = "runs") -> None:
        self.run_id = run_id
        self.dir = Path(base_dir) / run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        chmod_quiet(self.dir, 0o700)
        self.events_path = self.dir / "events.jsonl"
        self.db_path = self.dir / "index.sqlite"
        self._init_db()

    def _init_db(self) -> None:
        con = sqlite3.connect(self.db_path)
        try:
            con.execute(
                "CREATE TABLE IF NOT EXISTS findings ("
                "id TEXT PRIMARY KEY, objective_id TEXT, severity TEXT, title TEXT, "
                "taxonomy TEXT, created_at TEXT)"
            )
            con.commit()
        finally:
            con.close()

    def event(self, kind: str, **data: object) -> None:
        """Append one redacted event to the JSONL log."""
        record = {"ts": datetime.now(UTC).isoformat(), "kind": kind, **data}
        line = json.dumps(redact(record), ensure_ascii=False)
        with open(self.events_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        chmod_quiet(self.events_path, 0o600)

    def save_evidence(self, evidence: Evidence) -> Path:
        path = self.dir / f"evidence-{evidence.id}.json"
        data = redact(evidence.model_dump(mode="json"))
        atomic_write(path, json.dumps(data, ensure_ascii=False, indent=2))
        return path

    def save_finding(self, finding: Finding) -> Path:
        path = self.dir / f"finding-{finding.id}.json"
        data = finding.model_dump(mode="json")
        atomic_write(path, json.dumps(data, ensure_ascii=False, indent=2))
        con = sqlite3.connect(self.db_path)
        try:
            con.execute(
                "INSERT OR REPLACE INTO findings VALUES (?,?,?,?,?,?)",
                (
                    finding.id,
                    finding.objective_id,
                    finding.severity.value,
                    finding.title,
                    ",".join(f"{t.framework}:{t.id}" for t in finding.taxonomy),
                    finding.created_at.isoformat(),
                ),
            )
            con.commit()
        finally:
            con.close()
        return path

    def list_findings(self) -> list[dict]:
        con = sqlite3.connect(self.db_path)
        try:
            rows = con.execute(
                "SELECT id, objective_id, severity, title, taxonomy, created_at FROM findings"
            ).fetchall()
        finally:
            con.close()
        cols = ["id", "objective_id", "severity", "title", "taxonomy", "created_at"]
        return [dict(zip(cols, r, strict=True)) for r in rows]
