"""Fetch a pinned dataset to a local cache and parse it. Downloads can be turned off.

A dataset is fetched once from its pinned commit URL to the cache directory, then parsed on every
load. With downloads disabled (offline), only a cached copy is used; nothing is fetched. No dataset
is ever written into the repository or the package.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

from .base import DatasetCase, get_dataset
from .parsers import PARSERS

# Set to "1" to forbid any dataset download; a load then needs a cached file or it fails.
OFFLINE_ENV = "MODELWRECKER_DATASETS_OFFLINE"
_FETCH_TIMEOUT = 30.0
_MAX_BYTES = 64 * 1024 * 1024  # a benchmark file over 64 MB is refused, to bound memory


class DatasetError(RuntimeError):
    """A dataset could not be fetched, read, or parsed. The message is safe to show."""


def cache_dir() -> Path:
    """Where datasets are cached. Override with MODELWRECKER_DATASETS_DIR."""
    override = os.environ.get("MODELWRECKER_DATASETS_DIR")
    if override:
        return Path(override)
    base = os.environ.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(base) / "modelwrecker" / "datasets"


def _is_offline(offline: bool) -> bool:
    return offline or os.environ.get(OFFLINE_ENV) == "1"


def ensure_file(name: str, *, offline: bool = False) -> Path:
    """Return the cached file for a dataset, fetching it from its pinned URL if needed."""
    info = get_dataset(name)
    dest = cache_dir() / name / f"{info.ref}.data"
    if dest.exists():
        return dest
    if _is_offline(offline):
        raise DatasetError(
            f"{name} is not cached and downloads are off ({OFFLINE_ENV}=1). "
            f"Fetch it once with downloads enabled, or set MODELWRECKER_DATASETS_DIR to a copy."
        )
    url = info.url.format(ref=info.ref)
    if not url.startswith("https://"):
        raise DatasetError(f"{name} source is not https")
    try:
        with httpx.Client(timeout=_FETCH_TIMEOUT, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.content
    except httpx.HTTPError as e:
        raise DatasetError(f"could not fetch {name}: {e}") from e
    if len(data) > _MAX_BYTES:
        raise DatasetError(f"{name} file is larger than the {_MAX_BYTES} byte cap")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return dest


def parse_file(name: str, path: Path | str) -> list[DatasetCase]:
    """Parse a cached dataset file (JSON or JSON Lines) into normalized cases."""
    text = Path(path).read_text(encoding="utf-8")
    try:
        rows: object = json.loads(text)
    except json.JSONDecodeError:
        rows = [json.loads(line) for line in text.splitlines() if line.strip()]
    parser = PARSERS.get(name)
    if parser is None:
        raise DatasetError(f"no parser for dataset {name!r}")
    try:
        return parser(rows)
    except (ValueError, KeyError, TypeError) as e:
        raise DatasetError(f"{name} did not match the expected schema: {e}") from e


def load_cases(name: str, *, offline: bool = False, limit: int | None = None) -> list[DatasetCase]:
    """Fetch (if needed) and parse a dataset into cases. `limit` caps how many are returned."""
    cases = parse_file(name, ensure_file(name, offline=offline))
    return cases[:limit] if limit else cases
