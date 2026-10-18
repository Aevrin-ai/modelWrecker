"""Small value helpers for the sync body: capped and redacted text, bounded numbers, UTC times."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from ..security.redaction import redact_text

# cap user-authored labels (titles, names) so one long string cannot bloat the body
MAX_TEXT = 300


def json_size(obj: object) -> int:
    """Worst-case JSON size in bytes (every non-ASCII character escaped)."""
    return len(json.dumps(obj, ensure_ascii=True))


def label(value: object, limit: int) -> str:
    """A short redacted label: '  Title  ' -> 'Title', cut to `limit` characters."""
    return "" if value is None else redact_text(str(value)).strip()[:limit]


def body_text(value: object, limit: int) -> str:
    """Free text: redact first, then cap, so a redaction can never push it over the limit."""
    return "" if value is None else redact_text(str(value))[:limit]


def short_text(value: object) -> str:
    """A user-authored value as text, cut to MAX_TEXT characters."""
    if value is None:
        return ""
    return str(value)[:MAX_TEXT]


def rate(value: object) -> float:
    """A rate between 0 and 1, rounded to 4 places; anything unreadable is 0.0."""
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.0
    return round(min(1.0, max(0.0, number)), 4)


def bounded_int(value: object, low: int, high: int | None = None) -> int:
    """An integer clamped to [low, high]; anything unreadable is `low`."""
    try:
        number = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return low
    number = max(low, number)
    return min(high, number) if high is not None else number


def parse_time(value: object) -> datetime | None:
    """An ISO timestamp as an aware datetime: '2026-10-02T02:08:50Z' -> 02:08:50 UTC."""
    if not isinstance(value, str) or not value:
        return None
    try:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def iso_time(moment: datetime) -> str:
    """A datetime as UTC text to the second, e.g. '2026-10-02T02:08:50Z'."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
