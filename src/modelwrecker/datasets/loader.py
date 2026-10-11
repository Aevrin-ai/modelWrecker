"""Fetch a pinned dataset to a local cache and parse it. Downloads can be turned off.

Each labelled file of a dataset is fetched once from its pinned commit URL to the cache directory,
then parsed on every load. With downloads disabled (offline), only cached copies are used;
nothing is fetched. No dataset is ever written into the repository or the package.
"""

from __future__ import annotations

import csv
import io
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


def ensure_file(name: str, label: str = "main", *, offline: bool = False) -> Path:
    """Return the cached file for one labelled part of a dataset, fetching it if needed."""
    info = get_dataset(name)
    if label not in info.files:
        raise DatasetError(f"{name} has no file labelled {label!r}")
    dest = cache_dir() / name / f"{info.ref}-{label}.data"
    if dest.exists():
        return dest
    if _is_offline(offline):
        raise DatasetError(
            f"{name} is not cached and downloads are off ({OFFLINE_ENV}=1). "
            f"Fetch it once with downloads enabled, or set MODELWRECKER_DATASETS_DIR to a copy."
        )
    url = info.files[label].format(ref=info.ref)
    if not url.startswith("https://"):
        raise DatasetError(f"{name} source is not https")
    try:
        with httpx.Client(timeout=_FETCH_TIMEOUT, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.content
    except httpx.HTTPError as e:
        raise DatasetError(f"could not fetch {name} ({label}): {e}") from e
    if len(data) > _MAX_BYTES:
        raise DatasetError(f"{name} file is larger than the {_MAX_BYTES} byte cap")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return dest


def _read(fmt: str, path: Path | str) -> list:
    """Read one cached file by format into a list of records."""
    text = Path(path).read_text(encoding="utf-8")
    if fmt == "csv":
        return list(csv.DictReader(io.StringIO(text)))
    if fmt == "jsonl":
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    data = json.loads(text)
    return data if isinstance(data, list) else [data]


def parse_files(name: str, paths: dict[str, Path | str]) -> list[DatasetCase]:
    """Parse a dataset's cached files (label -> path) into normalized cases."""
    info = get_dataset(name)
    parser = PARSERS.get(name)
    if parser is None:
        raise DatasetError(f"no parser for dataset {name!r}")
    rows = {label: _read(info.fmt, path) for label, path in paths.items()}
    try:
        return parser(rows)
    except (ValueError, KeyError, TypeError) as e:
        raise DatasetError(f"{name} did not match the expected schema: {e}") from e


def load_cases(name: str, *, offline: bool = False, limit: int | None = None) -> list[DatasetCase]:
    """Fetch (if needed) and parse a dataset into cases. `limit` caps how many are returned."""
    info = get_dataset(name)
    paths = {label: ensure_file(name, label, offline=offline) for label in info.files}
    cases = parse_files(name, paths)
    return cases[:limit] if limit else cases
