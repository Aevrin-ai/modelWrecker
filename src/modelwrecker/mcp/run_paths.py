"""Keep MCP run ids and evidence ids to one safe path component inside the runs directory."""

from __future__ import annotations

from pathlib import Path

from .guardrail_error import GuardrailError
from .guardrails import Guard


def safe_component(tool: str, name: object, guard: Guard) -> str:
    """A single path component with no separators or traversal. Rejects anything suspicious."""
    is_bad = (
        not isinstance(name, str) or not name or "/" in name or "\\" in name or ".." in name
        or name.startswith(".") or ":" in name or "\x00" in name or len(name) > 128
    )
    if is_bad:
        guard.deny(tool, {"id": name}, GuardrailError(
            f"invalid id {name!r}", check="path_scope", code="invalid_id"))
    return name


def safe_run_dir(runs_dir: Path, tool: str, run_id: str, guard: Guard) -> Path:
    """Resolve a run directory and confirm it is inside runs_dir (no traversal or symlink)."""
    args = {"run_id": run_id}
    component = safe_component(tool, run_id, guard)
    run_dir = (runs_dir / component).resolve()
    try:
        run_dir.relative_to(runs_dir)
    except ValueError:
        guard.deny(tool, args, GuardrailError(
            f"run id {run_id!r} is out of scope", check="path_scope", code="path_out_of_scope"))
    if not run_dir.is_dir():
        guard.deny(tool, args, GuardrailError(
            f"run {run_id!r} not found", check="path_scope", code="not_found"))
    return run_dir
