"""MCP guardrails: the checks every MCP tool call passes before it can reach the engine.

The MCP server must never become an unrestricted bridge into the attack engine. This module holds
the small, testable pieces of the guardrail chain (see docs/security/mcp.md):

1. Tool permission - only the documented tools, and only their documented arguments.
2. Rate limit - a per-process sliding window on all calls, plus a stricter one on `run`.
3. Path scope - config and run paths stay inside an allowed base directory.
4. Target scope - the target comes from the loaded config and must be `authorized: true`.
5. Entitlement - a pluggable hook. Locally it allows everything; cloud entitlements arrive in 10.14.
6. Resource limit - caps on objectives, concurrency, attempts, replays, retries, and time per call.

Every denial raises `GuardrailError` (a structured error) and is logged with secrets redacted. All
checks run before any model call, so a denied request never partially runs an attack.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import NoReturn, Protocol, runtime_checkable

from ..config import Config
from ..security.redaction import redact, redact_text

log = logging.getLogger("modelwrecker.mcp")

# The allowlist: every tool the MCP server offers, and the only argument names each one accepts. A
# tool that is not here does not exist. An argument that is not listed (for example `base_url` or
# `target`) is refused, so a caller can never smuggle an endpoint override past the config.
TOOL_ARGUMENTS: Mapping[str, frozenset[str]] = {
    "list_strategies": frozenset(),
    "validate_config": frozenset({"config_path"}),
    "run": frozenset({"config_path", "run_id"}),
    "get_findings": frozenset({"run_id"}),
    "get_report": frozenset({"run_id"}),
    "replay": frozenset({"run_id", "evidence_id"}),
}

# The arguments each tool cannot run without.
TOOL_REQUIRED: Mapping[str, frozenset[str]] = {
    "list_strategies": frozenset(),
    "validate_config": frozenset({"config_path"}),
    "run": frozenset({"config_path"}),
    "get_findings": frozenset({"run_id"}),
    "get_report": frozenset({"run_id"}),
    "replay": frozenset({"run_id", "evidence_id"}),
}

# Config files must look like config files. Anything else (a .env file, a key file) is refused.
CONFIG_SUFFIXES = (".yaml", ".yml")


class GuardrailError(Exception):
    """A request refused by a guardrail. Carries a stable code and the check that refused it.

    `check` is the guardrail stage (tool_permission, rate_limit, path_scope, config, target_scope,
    entitlement, resource_limit). `code` is a stable machine-readable reason. `message` is for
    people.
    """

    def __init__(
        self, message: str, *, check: str = "input", code: str = "invalid_request"
    ) -> None:
        super().__init__(message)
        self.message = message
        self.check = check
        self.code = code

    def to_dict(self) -> dict:
        return {"denied": True, "check": self.check, "code": self.code, "message": self.message}

    def __str__(self) -> str:
        return f"denied by {self.check} guardrail ({self.code}): {self.message}"


# --- limits ---------------------------------------------------------------------------------------


@dataclass(frozen=True)
class McpLimits:
    """Per-call and per-process caps for the MCP server. Enforced server-side, never trusting the
    caller.

    A config value above a cap is refused (not silently trimmed), so the caller learns why. A config
    that leaves a cap unset gets the MCP cap filled in, so an MCP run is always bounded.
    """

    max_objectives: int = 10  # objectives scheduled in one run
    max_concurrency: int = 4  # objectives running at the same time
    max_attempts: int = 200  # total strategy attempts in one run
    max_replays: int = 16  # reliability replays per candidate finding
    max_retries: int = 3  # retries per objective on transient errors
    max_seconds: int = 1800  # wall-clock budget for one run
    max_param_value: int = 50  # any integer in attack.params, e.g. best_of_n `n`
    calls_per_minute: int = 60  # all tool calls, per process
    runs_per_hour: int = 20  # `run` calls that reach the engine, per process
    max_active_runs: int = 1  # runs in progress at the same time, per process


class RateLimiter:
    """A sliding-window limiter: at most `max_calls` in any `window_seconds`. Thread-safe."""

    def __init__(
        self,
        max_calls: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_calls = max_calls
        self.window = window_seconds
        self._clock = clock
        self._hits: deque[float] = deque()
        self._lock = threading.Lock()

    def try_acquire(self) -> bool:
        with self._lock:
            now = self._clock()
            while self._hits and now - self._hits[0] >= self.window:
                self._hits.popleft()
            if len(self._hits) >= self.max_calls:
                return False
            self._hits.append(now)
            return True


# --- entitlement hook -----------------------------------------------------------------------------


@dataclass(frozen=True)
class EntitlementDecision:
    allowed: bool
    reason: str = ""


@runtime_checkable
class EntitlementChecker(Protocol):
    """Answers one question: can this operation run? (see docs/security/entitlements.md).

    The local default allows everything. Phase 10.14 plugs in a checker that verifies a signed,
    scoped entitlement from the cloud. A checker holds no pricing logic; it only says allowed or
    denied.
    """

    def check(self, operation: str, context: Mapping[str, object]) -> EntitlementDecision: ...


class LocalEntitlements:
    """The local default: every operation is allowed. No cloud call is made or faked."""

    def check(self, operation: str, context: Mapping[str, object]) -> EntitlementDecision:
        return EntitlementDecision(allowed=True, reason="local mode")


# --- the guard ------------------------------------------------------------------------------------


class Guard:
    """Holds the per-process guardrail state (rate limiters, active runs) and runs the checks."""

    def __init__(
        self,
        *,
        config_dir: Path,
        limits: McpLimits | None = None,
        entitlements: EntitlementChecker | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.config_dir = config_dir
        self.limits = limits if limits is not None else McpLimits()
        # `is None`, not `or`: a custom checker must never be swapped for allow-all by accident.
        self.entitlements = entitlements if entitlements is not None else LocalEntitlements()
        self._calls = RateLimiter(self.limits.calls_per_minute, 60.0, clock)
        self._runs = RateLimiter(self.limits.runs_per_hour, 3600.0, clock)
        self._active_runs = 0
        self._active_lock = threading.Lock()

    # -- denial ------------------------------------------------------------------------------------

    def deny(
        self, tool: str, arguments: Mapping[str, object] | None, err: GuardrailError
    ) -> NoReturn:
        """Log a denial with secrets redacted, then raise it. Never returns."""
        log.warning(
            "mcp denied tool=%s check=%s code=%s reason=%s arguments=%s",
            redact_text(str(tool)), err.check, err.code, redact_text(err.message),
            redact(dict(arguments or {})),
        )
        raise err

    # -- stage 1 and 2: tool permission + rate limit -----------------------------------------------

    def admit(self, tool: str, arguments: Mapping[str, object] | None) -> None:
        """Run the checks that need only the tool name and raw arguments. Every call starts here."""
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

    # -- stage 3: path scope -----------------------------------------------------------------------

    def confine_config_path(self, tool: str, config_path: object) -> Path:
        """Resolve a config path and confirm it is a .yaml/.yml file inside config_dir."""
        args = {"config_path": config_path}

        def bad(msg: str, code: str = "path_out_of_scope") -> NoReturn:
            self.deny(tool, args, GuardrailError(msg, check="path_scope", code=code))

        if not isinstance(config_path, str) or not config_path.strip():
            bad("config_path must be a non-empty string", "invalid_path")
        if "\x00" in config_path or "://" in config_path:
            bad(f"config_path {config_path!r} is not a local file path", "invalid_path")
        raw = Path(config_path)
        candidate = raw if raw.is_absolute() else self.config_dir / raw
        try:
            resolved = candidate.resolve()
        except (OSError, RuntimeError, ValueError):
            bad(f"config_path {config_path!r} cannot be resolved", "invalid_path")
        try:
            resolved.relative_to(self.config_dir)
        except ValueError:
            bad(f"config_path {config_path!r} is outside the allowed config directory")
        if resolved.suffix.lower() not in CONFIG_SUFFIXES:
            bad(f"config_path must end in {' or '.join(CONFIG_SUFFIXES)}", "invalid_path")
        if not resolved.is_file():
            bad(f"config file {config_path!r} not found in the allowed config directory",
                "config_not_found")
        return resolved

    # -- stage 4: target scope ---------------------------------------------------------------------

    def check_target_scope(self, tool: str, cfg: Config, args: Mapping[str, object]) -> None:
        """The target must be defined in the loaded config and explicitly authorized."""
        if cfg.target is None:
            self.deny(tool, args, GuardrailError(
                "no target is defined in the config; modelWrecker only attacks a target defined "
                "there", check="target_scope", code="unknown_target"))
        if cfg.target.authorized is not True:
            self.deny(tool, args, GuardrailError(
                "target is not authorized. Set `authorized: true` on the target in the config to "
                "confirm you have permission to test it.",
                check="target_scope", code="target_not_authorized"))

    # -- stage 5: entitlement ----------------------------------------------------------------------

    def check_entitlement(
        self, tool: str, operation: str, context: Mapping[str, object], args: Mapping[str, object]
    ) -> None:
        """Ask the entitlement hook. Fail safe: an error or a malformed answer is a denial."""
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

    # -- stage 6: resource limits ------------------------------------------------------------------

    def bounded_config(self, tool: str, cfg: Config, args: Mapping[str, object]) -> Config:
        """Return a copy of the config with every MCP cap enforced. Over-cap values are refused."""
        lim = self.limits
        camp = cfg.campaign
        budget = camp.budget

        def over(what: str, value: object, cap: int) -> NoReturn:
            self.deny(tool, args, GuardrailError(
                f"{what} is {value}; the MCP limit is {cap}. Lower it in the config or use the "
                "CLI.",
                check="resource_limit", code="campaign_too_large"))

        n_obj = len(cfg.objectives)
        if budget.max_objectives is not None:
            n_obj = min(n_obj, budget.max_objectives)
        if n_obj > lim.max_objectives:
            over("the number of objectives", n_obj, lim.max_objectives)
        if camp.concurrency > lim.max_concurrency:
            over("campaign.concurrency", camp.concurrency, lim.max_concurrency)
        if camp.retries > lim.max_retries:
            over("campaign.retries", camp.retries, lim.max_retries)
        if cfg.engine.replays > lim.max_replays:
            over("engine.replays", cfg.engine.replays, lim.max_replays)
        if budget.max_attempts is not None and budget.max_attempts > lim.max_attempts:
            over("campaign.budget.max_attempts", budget.max_attempts, lim.max_attempts)
        seconds = (
            budget.max_seconds if budget.max_seconds is not None else cfg.engine.deadline_seconds
        )
        if seconds and seconds > lim.max_seconds:
            over("the run time budget in seconds", seconds, lim.max_seconds)
        for key, value in cfg.attack.params.items():
            is_int = isinstance(value, int) and not isinstance(value, bool)
            if is_int and value > lim.max_param_value:
                over(f"attack.params.{key}", value, lim.max_param_value)

        # Fill unset caps so the run is always bounded, whatever the config left open.
        new_budget = budget.model_copy(update={
            "max_attempts": budget.max_attempts if budget.max_attempts is not None
            else lim.max_attempts,
            "max_seconds": seconds if seconds and seconds > 0 else lim.max_seconds,
        })
        return cfg.model_copy(update={"campaign": camp.model_copy(update={"budget": new_budget})})

    # -- run slots (rate limit on runs + active-run cap) -------------------------------------------

    def acquire_run_slot(self, tool: str, args: Mapping[str, object]) -> None:
        """Take a run slot. Called last, right before the engine, so a denied run uses no slot."""
        with self._active_lock:
            if self._active_runs >= self.limits.max_active_runs:
                busy = True
            else:
                busy = False
                if self._runs.try_acquire():
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
