"""Campaign scheduling: parallelism, budgets, stop conditions, retries.

The campaign engine is core IP we own (see docs/campaigns/OVERVIEW.md and CLAUDE.md). It schedules a
set of objectives against an already-built target/judge and aggregates results into one `RunResult`.
It never talks to providers itself: the caller passes a `run_one(objective)` coroutine that runs the
full single-objective loop, keeping provider construction (and its test seams) in the attack loop.

Design rules it enforces:
- A single objective failing never kills the campaign (errors are isolated per objective).
- Transient provider errors are retried up to a bounded count; other errors are not retried.
- A budget or stop condition ends the campaign cleanly, with partial results and a note.
- Stopping is cooperative: no objective is hard-cancelled mid-attack, so artifacts are never torn.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from ..data import Finding, Objective
from ..providers.base import ProviderError

if TYPE_CHECKING:  # pragma: no cover - typing only
    from ..attacker.loop import AttemptRecord, RunResult
    from ..config import Config

# What run_one returns: the (optional) finding for an objective plus its attempt transcript.
RunOne = Callable[[Objective], Awaitable["tuple[Finding | None, list[AttemptRecord]]"]]


@dataclass
class Budget:
    """A shared, cooperative budget for one campaign.

    Checked before each objective and before each strategy. Because asyncio runs on one thread, the
    plain counters are only mutated at these await-free points, so no lock is needed.
    """

    max_attempts: int | None = None
    max_tokens: int | None = None
    deadline: float | None = None  # a time.monotonic() value, or None for no wall-clock cap
    attempts: int = 0
    tokens: int = 0

    def time_exceeded(self) -> bool:
        return self.deadline is not None and time.monotonic() >= self.deadline

    def exhausted(self) -> tuple[bool, str]:
        """Return (is_exhausted, reason)."""
        if self.time_exceeded():
            return True, "time budget exhausted"
        if self.max_attempts is not None and self.attempts >= self.max_attempts:
            return True, "attempt budget exhausted"
        if self.max_tokens is not None and self.tokens >= self.max_tokens:
            return True, "token budget exhausted"
        return False, ""

    def record(self, *, attempts: int = 0, tokens: int = 0) -> None:
        self.attempts += attempts
        self.tokens += tokens


def build_budget(config: Config) -> Budget:
    """Build the budget from config. The wall-clock cap falls back to engine.deadline_seconds."""
    b = config.campaign.budget
    secs = b.max_seconds if b.max_seconds is not None else config.engine.deadline_seconds
    deadline = time.monotonic() + secs if secs and secs > 0 else None
    return Budget(max_attempts=b.max_attempts, max_tokens=b.max_tokens, deadline=deadline)


async def execute_campaign(
    *,
    config: Config,
    objectives: list[Objective],
    run_one: RunOne,
    result: RunResult,
    budget: Budget,
    emit: Callable[[str], None] = lambda _m: None,
) -> None:
    """Schedule every objective and aggregate findings/attempts into `result`.

    `run_one` runs the full single-objective loop and consults `budget` per strategy. This function
    owns concurrency, the stop condition, retries, and per-objective error isolation.
    """
    camp = config.campaign

    # max_objectives caps how many we schedule at all.
    if camp.budget.max_objectives is not None:
        if len(objectives) > camp.budget.max_objectives:
            result.notes.append(
                f"objective budget: running {camp.budget.max_objectives} of "
                f"{len(objectives)} objectives"
            )
        objectives = objectives[: camp.budget.max_objectives]

    sem = asyncio.Semaphore(max(1, camp.concurrency))
    stop = asyncio.Event()  # set when a stop condition fires; prevents new objectives from starting

    async def worker(objective: Objective) -> None:
        # Cooperative stop checks happen before acquiring the gate so queued work exits cheaply.
        if stop.is_set():
            result.notes.append(f"skipped '{objective.title}': stop condition reached")
            return
        exhausted, why = budget.exhausted()
        if exhausted:
            stop.set()
            result.notes.append(f"skipped '{objective.title}': {why}")
            return
        async with sem:
            if stop.is_set():
                result.notes.append(f"skipped '{objective.title}': stop condition reached")
                return
            emit(f"objective: {objective.title}")
            finding, records = await _run_isolated(run_one, objective, camp.retries, emit, result)
            result.objectives_run += 1
            result.attempts.extend(records)
            if finding is not None:
                result.findings.append(finding)
                if camp.stop_on == "first_finding":
                    stop.set()
                    emit("stop condition: first finding reached; not starting further objectives")
            if camp.stop_on == "budget" and budget.exhausted()[0]:
                stop.set()

    await asyncio.gather(*(worker(o) for o in objectives))


async def _run_isolated(
    run_one: RunOne,
    objective: Objective,
    retries: int,
    emit: Callable[[str], None],
    result: RunResult,
) -> tuple[Finding | None, list[AttemptRecord]]:
    """Run one objective with error isolation and bounded retries on transient errors only."""
    tries = 0
    while True:
        try:
            return await run_one(objective)
        except ProviderError as e:  # transient: retry up to the bound
            if tries >= retries:
                msg = f"objective '{objective.title}' failed after {tries + 1} attempt(s): {e}"
                result.notes.append(msg)
                emit(msg)
                return None, []
            tries += 1
            emit(f"retry {tries}/{retries} for '{objective.title}' after a transient error: {e}")
            await asyncio.sleep(min(0.1 * 2**tries, 2.0))
        except Exception as e:  # non-transient: isolate, never retry, never kill the campaign
            msg = f"objective '{objective.title}' errored (not retried): {e}"
            result.notes.append(msg)
            emit(msg)
            return None, []
