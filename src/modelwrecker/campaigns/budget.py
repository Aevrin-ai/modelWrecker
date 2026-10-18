"""The shared, cooperative budget that ends a campaign cleanly when a cap is reached."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - typing only
    from ..config import Config


@dataclass
class Budget:
    """A shared, cooperative budget for one campaign.

    Checked before each objective and before each strategy. Because asyncio runs on one thread, the
    plain counters are only mutated at these await-free points, so no lock is needed.
    """

    max_attempts: int | None = None
    max_tokens: int | None = None
    max_requests: int | None = None
    max_cost_usd: float | None = None
    deadline: float | None = None  # a time.monotonic() value, or None for no wall-clock cap
    attempts: int = 0
    tokens: int = 0
    meter: object = None  # a providers.meter.Meter; requests and cost are read from it

    def time_exceeded(self) -> bool:
        return self.deadline is not None and time.monotonic() >= self.deadline

    def exhausted(self) -> tuple[bool, str]:
        """Return (is_exhausted, reason)."""
        if self.time_exceeded():
            return True, "time budget exhausted"
        if self.max_attempts is not None and self.attempts >= self.max_attempts:
            return True, "attempt budget exhausted"
        if self.max_tokens is not None and self.tokens >= self.max_tokens:
            return True, "token budget exhausted"
        if self.max_requests is not None and self.meter is not None \
                and self.meter.requests >= self.max_requests:
            return True, "request budget exhausted"
        if self.max_cost_usd is not None and self.meter is not None \
                and self.meter.cost_usd >= self.max_cost_usd:
            return True, "cost budget exhausted"
        return False, ""

    def record(self, *, attempts: int = 0, tokens: int = 0) -> None:
        self.attempts += attempts
        self.tokens += tokens


def build_budget(config: Config) -> Budget:
    """Build the budget from config. The wall-clock cap falls back to engine.deadline_seconds."""
    caps = config.campaign.budget
    seconds = caps.max_seconds if caps.max_seconds is not None else config.engine.deadline_seconds
    deadline = time.monotonic() + seconds if seconds and seconds > 0 else None
    return Budget(max_attempts=caps.max_attempts, max_tokens=caps.max_tokens,
                  max_requests=caps.max_requests, max_cost_usd=caps.max_cost_usd,
                  deadline=deadline)
