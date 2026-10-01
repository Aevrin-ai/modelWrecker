"""Safe service layer behind the MCP tools.

Every function here is a safe orchestration operation: it never runs host commands, writes arbitrary
files, or fetches arbitrary URLs. The same security rules as the rest of the engine apply (authorized
targets only, egress guard, redaction). These functions are plain Python so they are easy to test
without the MCP transport (see tests/test_mcp.py).
"""

from __future__ import annotations

import os
from pathlib import Path

from ..config import ConfigError, load_config
from ..data import Finding
from ..findings.report import render_markdown
from ..strategies.registry import list_strategies


class GuardrailError(Exception):
    """Raised when an MCP request is rejected by a guardrail (unauthorized, out of scope, bad input)."""


class McpService:
    def __init__(self, runs_dir: str | Path = "runs") -> None:
        # The only directory the server will read run artifacts from. Reads are confined to it.
        self.runs_dir = Path(runs_dir).resolve()
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    # --- read-only tools ---------------------------------------------------------------------------

    def list_strategies(self) -> list[dict]:
        return list_strategies()

    def validate_config(self, config_path: str) -> dict:
        try:
            cfg = load_config(config_path)
        except ConfigError as e:
            return {"ok": False, "problems": [str(e)]}
        problems: list[str] = []
        for fn in (cfg.require_full, cfg.require_authorized_target, cfg.require_objectives):
            try:
                fn()
            except ConfigError as e:
                problems.append(str(e))
        return {"ok": not problems, "problems": problems}

    def get_findings(self, run_id: str) -> list[dict]:
        d = self._safe_run_dir(run_id)
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
        d = self._safe_run_dir(run_id)
        findings = [Finding.model_validate_json(fp.read_text(encoding="utf-8"))
                    for fp in sorted(d.glob("finding-*.json"))]
        return render_markdown(findings, run_id)

    # --- action tools ------------------------------------------------------------------------------

    async def run(self, config_path: str, run_id: str | None = None) -> dict:
        """Run a config's objectives against its (authorized) target and return a findings summary.

        Guardrails fire before any model call: the config must be complete, the target must be
        authorized, and there must be objectives.
        """
        try:
            cfg = load_config(config_path)
            cfg.require_full()
            cfg.require_authorized_target()
            cfg.require_objectives()
        except ConfigError as e:
            raise GuardrailError(str(e)) from e

        from ..attacker.loop import run_config
        from ..storage.store import RunStore

        store = RunStore(run_id=run_id or _new_run_id(), base_dir=str(self.runs_dir))
        result = await run_config(cfg, store=store, run_id=store.run_id)
        return {
            "run_id": result.run_id,
            "objectives_run": result.objectives_run,
            "findings": self.get_findings(result.run_id),
            "calibration": result.calibration,
            "notes": result.notes,
        }

    def replay(self, run_id: str, evidence_id: str) -> dict:
        d = self._safe_run_dir(run_id)
        name = f"evidence-{_safe_component(evidence_id)}.json"
        p = d / name
        if not p.exists():
            raise GuardrailError(f"evidence {evidence_id!r} not found in run {run_id!r}")
        import json
        data = json.loads(p.read_text(encoding="utf-8"))
        return {"payload": data.get("payload", ""), "reproduction_steps": data.get("reproduction_steps", "")}

    # --- guardrails --------------------------------------------------------------------------------

    def _safe_run_dir(self, run_id: str) -> Path:
        """Resolve a run directory and confirm it is really inside runs_dir (no traversal/symlink escape)."""
        component = _safe_component(run_id)
        d = (self.runs_dir / component).resolve()
        try:
            d.relative_to(self.runs_dir)
        except ValueError as e:
            raise GuardrailError(f"run id {run_id!r} is out of scope") from e
        if not d.is_dir():
            raise GuardrailError(f"run {run_id!r} not found")
        return d


def _safe_component(name: str) -> str:
    """A single path component with no separators or traversal. Rejects anything suspicious."""
    if not name or "/" in name or "\\" in name or ".." in name or name.startswith("."):
        raise GuardrailError(f"invalid id {name!r}")
    return name


def authorize(token: str | None) -> None:
    """Boundary auth for networked transport. When MW_MCP_TOKEN is set, a matching token is required.

    Over local stdio (the default), no token is set and this is a no-op. A networked transport must set
    MW_MCP_TOKEN and pass the matching token (see docs/features/harness-integration.md).
    """
    expected = os.environ.get("MW_MCP_TOKEN")
    if expected and token != expected:
        raise GuardrailError("unauthorized: missing or invalid MCP token")


def _new_run_id() -> str:
    import uuid
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8]
