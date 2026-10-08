"""Small file helpers shared by run storage, the device credential, the entitlement, and the outbox.

This module imports nothing else from the package, so any module can use it without import cycles.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path


def chmod_quiet(path: Path, mode: int) -> None:
    """Set permissions, best effort (Windows ignores most mode bits)."""
    try:
        os.chmod(path, mode)
    except OSError:
        pass


def atomic_write(path: Path, text: str, *, prefix: str = ".mw-") -> None:
    """Write via a temp file + os.replace so a crash or reader never sees a torn file.

    mkstemp creates the temp file with 0600 already, so the content is never world-readable, not
    even for a moment; the final file keeps 0600.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=prefix, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    chmod_quiet(path, 0o600)


def new_run_id() -> str:
    """A sortable, unique run folder name: UTC timestamp plus 8 random hex characters."""
    return datetime.now(UTC).strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8]
