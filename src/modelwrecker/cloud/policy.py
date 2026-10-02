"""What a sync may include beyond summary metadata (issue #28).

The account owner turns detail on in the dashboard (Settings -> What syncs to Aevrin). The device
reads it from the API's heartbeat before each sync. Both kinds default to off, and the server keeps
detail only when the setting is on, whatever the client sends.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SyncPolicy:
    evidence: bool = False  # per finding: prompt sent, model reply, judge verdict
    transcripts: bool = False  # per run: every attempt; per finding: multi-turn conversation

    @property
    def any_detail(self) -> bool:
        return self.evidence or self.transcripts

    def describe(self) -> str:
        parts = ["metadata"]
        if self.evidence:
            parts.append("evidence")
        if self.transcripts:
            parts.append("transcripts")
        return " + ".join(parts)

    @classmethod
    def from_api(cls, data: object) -> SyncPolicy:
        """Parse the `sync` object of a heartbeat reply. Anything missing or odd means off."""
        if not isinstance(data, dict):
            return METADATA_ONLY
        return cls(evidence=data.get("evidence") is True,
                   transcripts=data.get("transcripts") is True)


METADATA_ONLY = SyncPolicy()
