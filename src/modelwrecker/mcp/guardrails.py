"""MCP guardrails: the checks every MCP tool call passes before it can reach the engine.

The MCP server must never become an unrestricted bridge into the attack engine. `Guard` runs the
guardrail chain (see docs/security/mcp.md):

1. Tool permission - only the documented tools, and only their documented arguments, so a caller
   can never smuggle an endpoint override past the config.
2. Rate limit - a per-process sliding window on all calls, plus a stricter one on `run`.
3. Path scope - config and run paths stay inside an allowed base directory.
4. Target scope - the target comes from the loaded config and must be `authorized: true`.
5. Entitlement - a pluggable hook. Locally it allows everything.
6. Resource limit - caps on objectives, concurrency, attempts, replays, retries, and time per call.

Every denial raises `GuardrailError` (a structured error) and is logged with secrets redacted. All
checks run before any model call, so a denied request never partially runs an attack.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import NoReturn

from ..config import Config
from ..security.redaction import redact, redact_text
from .entitlement_hook import EntitlementChecker, EntitlementDecision, LocalEntitlements
from .guardrail_error import GuardrailError
from .limits import McpLimits, RateLimiter, first_over_limit, with_caps_filled
from .path_scope import CONFIG_SUFFIXES, resolve_config_path

# re-exported: these lived in this module before it was split, and callers import them from here
__all__ = [
    "CONFIG_SUFFIXES",
    "TOOL_ARGUMENTS",
    "TOOL_REQUIRED",
    "EntitlementChecker",
    "EntitlementDecision",
    "Guard",
    "GuardrailError",
    "LocalEntitlements",
    "McpLimits",
    "RateLimiter",
]

log = logging.getLogger("modelwrecker.mcp")

# unlisted tools do not exist, and unlisted arguments such as base_url or target are refused
TOOL_ARGUMENTS: Mapping[str, frozenset[str]] = {
    "list_strategies": frozenset(),
    "validate_config": frozenset({"config_path"}),
    "run": frozenset({"config_path", "run_id"}),
    "get_findings": frozenset({"run_id"}),
    "get_report": frozenset({"run_id"}),
    "replay": frozenset({"run_id", "evidence_id"}),
}

# the arguments each tool cannot run without
TOOL_REQUIRED: Mapping[str, frozenset[str]] = {
    "list_strategies": frozenset(),
    "validate_config": frozenset({"config_path"}),
    "run": frozenset({"config_path"}),
    "get_findings": frozenset({"run_id"}),
    "get_report": frozenset({"run_id"}),
    "replay": frozenset({"run_id", "evidence_id"}),
}


class Guard:
    """Holds the per-process guardrail state (rate limiters, active runs) and runs the checks."""

    def __init__(self, *, config_dir: Path, limits: McpLimits | None = None,
                 entitlements: EntitlementChecker | None = None,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.config_dir = config_dir
        self.limits = limits if limits is not None else McpLimits()
        # compare with None, not `or`, so a custom checker is never swapped for allow-all
        self.entitlements = entitlements if entitlements is not None else LocalEntitlements()
        self._calls = RateLimiter(self.limits.calls_per_minute, 60.0, clock)
        self._runs = RateLimiter(self.limits.runs_per_hour, 3600.0, clock)
        self._active_runs = 0
        self._active_lock = threading.Lock()

    def deny(self, tool: str, arguments: Mapping[str, object] | None,
             err: GuardrailError) -> NoReturn:
        """Log a denial with secrets redacted, then raise it. Never returns."""
        log.warning(
            "mcp denied tool=%s check=%s code=%s reason=%s arguments=%s",
            redact_text(str(tool)), err.check, err.code, redact_text(err.message),
            redact(dict(arguments or {})),
        )
        raise err

    def admit(self, tool: str, arguments: Mapping[str, object] | None) -> None:
        """Stages 1 and 2: tool permission and the call rate limit. Every call starts here."""
        if not isinstance(tool, str) or tool not in TOOL_ARGUMENTS:
            self.deny(str(tool), arguments, GuardrailError(
                f"unknown tool {tool!r}; allowed tools: {sorted(TOOL_ARGUMENTS)}",
                check="tool_permission", code="unknown_tool"))
        args = arguments or {}
        if not isinstance(args, Mapping):
            self.deny(tool, None, GuardrailError(
                "arguments must be an object", check="tool_permission", code="bad_arguments"))
        extra = sorted(str(k) for k in args if k not in TOOL_ARGUMENTS[tool])
        if extra:
            self.deny(tool, args, GuardrailError(
                f"argument(s) {extra} are not accepted by {tool!r}. Targets and endpoints come "
                "only from the loaded config; a tool call cannot override them.",
                check="tool_permission", code="unexpected_argument"))
        missing = sorted(TOOL_REQUIRED[tool] - set(args))
        if missing:
            self.deny(tool, args, GuardrailError(
                f"missing required argument(s) {missing} for {tool!r}",
                check="tool_permission", code="missing_argument"))
        if not self._calls.try_acquire():
            self.deny(tool, args, GuardrailError(
                f"more than {self.limits.calls_per_minute} tool calls in a minute; slow down",
                check="rate_limit", code="rate_limited"))

    def confine_config_path(self, tool: str, config_path: object) -> Path:
        """Stage 3: resolve a config path and confirm it is a .yaml/.yml file inside config_dir."""
        try:
            return resolve_config_path(self.config_dir, config_path)
        except GuardrailError as err:
            self.deny(tool, {"config_path": config_path}, err)

    def check_target_scope(self, tool: str, cfg: Config, args: Mapping[str, object]) -> None:
        """Stage 4: the target must be defined in the loaded config and explicitly authorized."""
        if cfg.target is None:
            self.deny(tool, args, GuardrailError(
                "no target is defined in the config; modelWrecker only attacks a target defined "
                "there", check="target_scope", code="unknown_target"))
        if cfg.target.authorized is not True:
            self.deny(tool, args, GuardrailError(
                "target is not authorized. Set `authorized: true` on the target in the config to "
                "confirm you have permission to test it.",
                check="target_scope", code="target_not_authorized"))

    def check_entitlement(self, tool: str, operation: str, context: Mapping[str, object],
                          args: Mapping[str, object]) -> None:
        """Stage 5: ask the entitlement hook. Fail safe: an error or bad answer is a denial."""
        try:
            decision = self.entitlements.check(operation, context)
        except Exception as e:  # any failure to verify is a denial, never an allow
            decision = EntitlementDecision(False, f"entitlement check failed: {type(e).__name__}")
        if not isinstance(decision, EntitlementDecision):
            decision = EntitlementDecision(False, "entitlement check returned no decision")
        if not decision.allowed:
            self.deny(tool, args, GuardrailError(
                f"operation {operation!r} is not allowed: {decision.reason or 'denied'}",
                check="entitlement", code="not_entitled"))

    def bounded_config(self, tool: str, cfg: Config, args: Mapping[str, object]) -> Config:
        """Stage 6: a copy of the config with every MCP cap enforced. Over-cap values fail."""
        over = first_over_limit(cfg, self.limits)
        if over is not None:
            what, value, cap = over
            self.deny(tool, args, GuardrailError(
                f"{what} is {value}; the MCP limit is {cap}. Lower it in the config or use the "
                "CLI.",
                check="resource_limit", code="campaign_too_large"))
        return with_caps_filled(cfg, self.limits)

    def acquire_run_slot(self, tool: str, args: Mapping[str, object]) -> None:
        """Take a run slot. Called last, right before the engine, so a denied run uses no slot."""
        with self._active_lock:
            busy = self._active_runs >= self.limits.max_active_runs
            if not busy and self._runs.try_acquire():
                self._active_runs += 1
                return
        if busy:
            self.deny(tool, args, GuardrailError(
                f"{self.limits.max_active_runs} run(s) already in progress; wait for it to finish",
                check="rate_limit", code="run_in_progress"))
        self.deny(tool, args, GuardrailError(
            f"more than {self.limits.runs_per_hour} runs in an hour; try again later",
            check="rate_limit", code="run_rate_limited"))

    def release_run_slot(self) -> None:
        with self._active_lock:
            self._active_runs = max(0, self._active_runs - 1)
