"""Where the engine keeps its entitlement and its own usage count.

- The signed token comes from `MODELWRECKER_ENTITLEMENT` first (for CI), else `entitlement.jws`
  next to the device credential (see cloud/credentials.py). It is signed, so the file needs no
  protection beyond normal permissions; editing it only makes it invalid.
- `usage.json` counts campaign runs and attack attempts per calendar month (UTC) on this machine.
  The engine uses the larger of this count and the count the cloud signed, so a run is counted even
  offline.
"""

from __future__ import annotations

import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path

from ..cloud import credentials
from ..storage.files import atomic_write
from .model import FREE_BASELINE, Entitlement
from .token import EntitlementError, verify_token

ENV_TOKEN = "MODELWRECKER_ENTITLEMENT"
TOKEN_FILE = "entitlement.jws"
USAGE_FILE = "usage.json"


def _dir() -> Path:
    return credentials.credential_path().parent


def token_path() -> Path:
    return _dir() / TOKEN_FILE


def usage_path() -> Path:
    return _dir() / USAGE_FILE


def period_key(now: float | None = None) -> str:
    dt = datetime.fromtimestamp(time.time() if now is None else now, UTC)
    return f"{dt.year:04d}-{dt.month:02d}"


def save_token(token: str) -> Entitlement:
    """Verify, then store. Raises EntitlementError and stores nothing when the token is invalid."""
    ent = verify_token(token)
    atomic_write(token_path(), token.strip())
    return ent


def clear_token() -> bool:
    try:
        token_path().unlink()
    except FileNotFoundError:
        return False
    return True


def cached_token_age(now: float | None = None) -> float | None:
    """Seconds since the stored token was written, or None when there is none."""
    try:
        mtime = token_path().stat().st_mtime
    except OSError:
        return None
    return (time.time() if now is None else now) - mtime


def load(now: float | None = None) -> tuple[Entitlement, str]:
    """The entitlement in force and a short note on where it came from.

    Never raises: anything missing, unreadable, tampered with, or expired gives the free baseline.
    """
    env = os.environ.get(ENV_TOKEN, "").strip()
    if env:
        try:
            return verify_token(env, now=now), f"signed ({ENV_TOKEN})"
        except EntitlementError as e:
            return FREE_BASELINE, f"free baseline: {ENV_TOKEN} rejected ({e})"
    path = token_path()
    if not path.exists():
        return FREE_BASELINE, "free baseline: not signed in (run `modelwrecker login`)"
    try:
        token = path.read_text(encoding="utf-8")
    except OSError:
        return FREE_BASELINE, "free baseline: the stored entitlement is unreadable"
    try:
        return verify_token(token, now=now), "signed"
    except EntitlementError as e:
        return FREE_BASELINE, f"free baseline: stored entitlement rejected ({e})"


def read_usage(now: float | None = None) -> dict[str, int]:
    """This machine's count for the current period: {"campaigns": n, "attacks": n}."""
    key = period_key(now)
    try:
        data = json.loads(usage_path().read_text(encoding="utf-8"))
        row = data.get(key, {}) if isinstance(data, dict) else {}
    except (OSError, ValueError):
        row = {}
    return {"campaigns": int(row.get("campaigns", 0) or 0),
            "attacks": int(row.get("attacks", 0) or 0)}


def record_usage(
    *, campaigns: int = 0, attacks: int = 0, now: float | None = None
) -> dict[str, int]:
    key = period_key(now)
    try:
        data = json.loads(usage_path().read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            data = {}
    except (OSError, ValueError):
        data = {}
    row = data.get(key, {}) if isinstance(data.get(key), dict) else {}
    row = {"campaigns": int(row.get("campaigns", 0) or 0) + campaigns,
           "attacks": int(row.get("attacks", 0) or 0) + attacks}
    # Keep the last 12 periods only.
    data = {k: v for k, v in sorted(data.items())[-11:] if k != key}
    data[key] = row
    try:
        atomic_write(usage_path(), json.dumps(data, indent=2, sort_keys=True))
    except OSError:
        pass  # counting is best effort; it never fails a finished run
    return row


def effective_usage(ent: Entitlement, now: float | None = None) -> dict[str, int]:
    """The larger of this machine's count and the cloud's signed count, for the current period."""
    local = read_usage(now)
    signed = ent.usage if ent.usage.get("period") == period_key(now) else {}
    return {m: max(local.get(m, 0), int(signed.get(m, 0) or 0)) for m in ("campaigns", "attacks")}
