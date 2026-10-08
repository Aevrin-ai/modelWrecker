"""Safe service layer behind the MCP tools.

Every function here is a safe orchestration operation: it never runs host commands, writes arbitrary
files, or fetches arbitrary URLs. Every MCP tool call passes the guardrail chain in `guardrails.py`
(tool permission, rate limit, path scope, target scope, entitlement, resource limit) before the
shared engine runs anything. See docs/security/mcp.md.

`call(tool, arguments)` is the single transport-agnostic entry point: it admits the call (tool
allowlist, argument allowlist, rate limit) and dispatches it. The MCP server runs the same `admit`
step on the raw arguments before the SDK sees them. These functions are plain Python so they are
easy to test without the MCP transport (see tests/test_mcp.py).
"""

from __future__ import annotations

import json
import os
import time
from collections.abc import Callable, Mapping
from pathlib import Path

from ..config import Config, ConfigError, load_config
from ..data import Finding
from ..findings.report import load_run, render_markdown
from ..storage.files import new_run_id
from ..strategies.registry import list_strategies
from .guardrails import (
    TOOL_ARGUMENTS,
    EntitlementChecker,
    Guard,
    GuardrailError,
    McpLimits,
)

__all__ = ["McpService", "GuardrailError", "authorize"]


class McpService:
    def __init__(
        self,
        runs_dir: str | Path = "runs",
        config_dir: str | Path = ".",
        *,
        limits: McpLimits | None = None,
        entitlements: EntitlementChecker | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        # The only directory the server reads and writes run artifacts in.
        self.runs_dir = Path(runs_dir).resolve()
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        # The only directory the server reads config files from.
        self.config_dir = Path(config_dir).resolve()
        self.guard = Guard(
            config_dir=self.config_dir, limits=limits, entitlements=entitlements, clock=clock
        )

    # --- the guarded entry point ------------------------------------------------------------------

    def admit(self, tool: str, arguments: Mapping[str, object] | None) -> None:
        """Tool permission + argument allowlist + rate limit. Every MCP call starts here."""
        self.guard.admit(tool, arguments)

    async def call(self, tool: str, arguments: Mapping[str, object] | None = None) -> object:
        """Admit a tool call, then dispatch it to the matching safe operation."""
        self.admit(tool, arguments)
        # admit() refused unknown tools, unknown arguments, and missing required arguments.
        args = dict(arguments or {})
        if tool == "list_strategies":
            return self.list_strategies()
        if tool == "validate_config":
            return self.validate_config(**args)
        if tool == "run":
            return await self.run(**args)
        if tool == "get_findings":
            return self.get_findings(**args)
        if tool == "get_report":
            return self.get_report(**args)
        if tool == "replay":
            return self.replay(**args)
        raise AssertionError(f"tool {tool!r} is allowlisted but has no handler: {TOOL_ARGUMENTS}")

    # --- read-only tools --------------------------------------------------------------------------

    def list_strategies(self) -> list[dict]:
        return list_strategies()

    def validate_config(self, config_path: str) -> dict:
        path = self.guard.confine_config_path("validate_config", config_path)
        try:
            cfg = load_config(path)
        except ConfigError as e:
            return {"ok": False, "problems": [str(e)]}
        problems = cfg.problems()
        return {"ok": not problems, "problems": problems}

    def get_findings(self, run_id: str) -> list[dict]:
        d = self._safe_run_dir("get_findings", run_id)
        out: list[dict] = []
        for fp in sorted(d.glob("finding-*.json")):
            f = Finding.model_validate_json(fp.read_text(encoding="utf-8"))
            out.append({
                "id": f.id, "severity": f.severity.value, "title": f.title,
                "summary": f.summary,
                "taxonomy": [f"{t.framework}:{t.id}" for t in f.taxonomy],
            })
        return out

    def get_report(self, run_id: str) -> str:
        d = self._safe_run_dir("get_report", run_id)
        findings, attempts = load_run(d)
        return render_markdown(findings, run_id, attempts)

    def replay(self, run_id: str, evidence_id: str) -> dict:
        args = {"run_id": run_id, "evidence_id": evidence_id}
        d = self._safe_run_dir("replay", run_id)
        name = f"evidence-{_safe_component('replay', evidence_id, self.guard)}.json"
        p = d / name
        if not p.exists():
            self.guard.deny("replay", args, GuardrailError(
                f"evidence {evidence_id!r} not found in run {run_id!r}",
                check="path_scope", code="not_found"))
        data = json.loads(p.read_text(encoding="utf-8"))
        return {"payload": data.get("payload", ""),
                "reproduction_steps": data.get("reproduction_steps", "")}

    # --- the action tool --------------------------------------------------------------------------

    async def run(self, config_path: str, run_id: str | None = None) -> dict:
        """Run a config's objectives against its authorized target and return a findings summary.

        Every guardrail fires before any model call. A denied run never starts, so nothing is
        partially attacked and no run directory is created.
        """
        args = {"config_path": config_path, "run_id": run_id}
        cfg = self._checked_run_config(config_path, run_id, args)

        from ..attacker.loop import run_config
        from ..storage.store import RunStore

        self.guard.acquire_run_slot("run", args)  # last check; takes a slot only if all else passed
        try:
            store = RunStore(run_id=run_id or new_run_id(), base_dir=str(self.runs_dir))
            result = await run_config(cfg, store=store, run_id=store.run_id)
        finally:
            self.guard.release_run_slot()
        return {
            "run_id": result.run_id,
            "objectives_run": result.objectives_run,
            "findings": self.get_findings(result.run_id),
            "calibration": result.calibration,
            "notes": result.notes,
        }

    def _checked_run_config(
        self, config_path: str, run_id: str | None, args: Mapping[str, object]
    ) -> Config:
        """Path scope -> config -> target scope -> entitlement -> resource limit. Returns a bounded
        copy of the config that is safe to hand to the engine."""
        g = self.guard
        path = g.confine_config_path("run", config_path)
        if run_id is not None:
            _safe_component("run", run_id, g)
            if (self.runs_dir / run_id).exists():
                g.deny("run", args, GuardrailError(
                    f"run {run_id!r} already exists; pick a new run id",
                    check="path_scope", code="run_exists"))
        try:
            cfg = load_config(path)
        except ConfigError as e:
            g.deny("run", args, GuardrailError(str(e), check="config", code="invalid_config"))
        g.check_target_scope("run", cfg, args)
        try:
            cfg.require_full()
            cfg.require_objectives()
        except ConfigError as e:
            g.deny("run", args, GuardrailError(str(e), check="config", code="invalid_config"))
        assert cfg.target is not None  # check_target_scope refused a missing target
        g.check_entitlement("run", "run", {
            "target_type": cfg.target.type or "chat",
            "strategy": cfg.attack.strategy,
            "objectives": len(cfg.objectives),
        }, args)
        return g.bounded_config("run", cfg, args)

    # --- helpers ----------------------------------------------------------------------------------

    def _safe_run_dir(self, tool: str, run_id: str) -> Path:
        """Resolve a run directory and confirm it is inside runs_dir (no traversal or symlink)."""
        args = {"run_id": run_id}
        component = _safe_component(tool, run_id, self.guard)
        d = (self.runs_dir / component).resolve()
        try:
            d.relative_to(self.runs_dir)
        except ValueError:
            self.guard.deny(tool, args, GuardrailError(
                f"run id {run_id!r} is out of scope", check="path_scope", code="path_out_of_scope"))
        if not d.is_dir():
            self.guard.deny(tool, args, GuardrailError(
                f"run {run_id!r} not found", check="path_scope", code="not_found"))
        return d


def _safe_component(tool: str, name: object, guard: Guard) -> str:
    """A single path component with no separators or traversal. Rejects anything suspicious."""
    if (
        not isinstance(name, str) or not name or "/" in name or "\\" in name or ".." in name
        or name.startswith(".") or ":" in name or "\x00" in name or len(name) > 128
    ):
        guard.deny(tool, {"id": name}, GuardrailError(
            f"invalid id {name!r}", check="path_scope", code="invalid_id"))
    return name


def authorize(token: str | None) -> None:
    """Boundary auth for a future networked transport. When MW_MCP_TOKEN is set, a matching token is
    required.

    Over local stdio (the only transport today), no token is set and this is a no-op. Authenticated
    remote transport is a later Phase 10.5 step (see docs/security/mcp.md).
    """
    expected = os.environ.get("MW_MCP_TOKEN")
    if expected and token != expected:
        raise GuardrailError("unauthorized: missing or invalid MCP token",
                             check="authentication", code="unauthenticated")

