"""The MCP server's caps: per-call resource limits, call rate limits, and how they are checked."""

from __future__ import annotations

import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

from ..config import Config


@dataclass(frozen=True)
class McpLimits:
    """Per-call and per-process caps for the MCP server, enforced server-side.

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

    def __init__(self, max_calls: int, window_seconds: float,
                 clock: Callable[[], float] = time.monotonic) -> None:
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


def run_seconds(cfg: Config) -> int | None:
    """The run's wall-clock budget: campaign.budget.max_seconds, else engine.deadline_seconds."""
    budget = cfg.campaign.budget
    return budget.max_seconds if budget.max_seconds is not None else cfg.engine.deadline_seconds


def first_over_limit(cfg: Config, limits: McpLimits) -> tuple[str, object, int] | None:
    """The first config value above its MCP cap, as (what, value, cap), or None if all fit."""
    campaign = cfg.campaign
    budget = campaign.budget
    objective_count = len(cfg.objectives)
    if budget.max_objectives is not None:
        objective_count = min(objective_count, budget.max_objectives)
    seconds = run_seconds(cfg)
    checks: list[tuple[str, object, int, bool]] = [
        ("the number of objectives", objective_count, limits.max_objectives,
         objective_count > limits.max_objectives),
        ("campaign.concurrency", campaign.concurrency, limits.max_concurrency,
         campaign.concurrency > limits.max_concurrency),
        ("campaign.retries", campaign.retries, limits.max_retries,
         campaign.retries > limits.max_retries),
        ("engine.replays", cfg.engine.replays, limits.max_replays,
         cfg.engine.replays > limits.max_replays),
        ("campaign.budget.max_attempts", budget.max_attempts, limits.max_attempts,
         budget.max_attempts is not None and budget.max_attempts > limits.max_attempts),
        ("the run time budget in seconds", seconds, limits.max_seconds,
         bool(seconds) and seconds > limits.max_seconds),
    ]
    for what, value, cap, is_over in checks:
        if is_over:
            return what, value, cap
    return _first_param_over_limit(cfg, limits)


def _first_param_over_limit(cfg: Config, limits: McpLimits) -> tuple[str, object, int] | None:
    for key, value in cfg.attack.params.items():
        is_int = isinstance(value, int) and not isinstance(value, bool)
        if is_int and value > limits.max_param_value:
            return f"attack.params.{key}", value, limits.max_param_value
    return None


def with_caps_filled(cfg: Config, limits: McpLimits) -> Config:
    """A copy of the config whose unset attempt and time caps get the MCP caps."""
    campaign = cfg.campaign
    budget = campaign.budget
    seconds = run_seconds(cfg)
    max_attempts = budget.max_attempts
    if max_attempts is None:
        max_attempts = limits.max_attempts
    new_budget = budget.model_copy(update={
        "max_attempts": max_attempts,
        "max_seconds": seconds if seconds and seconds > 0 else limits.max_seconds,
    })
    return cfg.model_copy(update={"campaign": campaign.model_copy(update={"budget": new_budget})})
