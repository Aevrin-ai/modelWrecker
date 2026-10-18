"""Campaign scheduling: parallelism, budgets, stop conditions, retries.

The campaign engine is core IP we own (see docs/campaigns/OVERVIEW.md and CLAUDE.md). It schedules a
set of objectives against an already-built target/judge and aggregates results into one `RunResult`.
It never talks to providers itself: the caller passes a `run_one(objective)` coroutine that runs the
full single-objective loop, keeping provider construction (and its test seams) in the attack loop.

Design rules it enforces:
- A single objective failing never kills the campaign (errors are isolated per objective).
- Transient provider errors are retried up to a bounded count, with backoff, jitter, and the
  provider's Retry-After. A permanent provider error (bad key, bad request, blocked address) and
  every other error are not retried.
- A budget or stop condition ends the campaign cleanly, with partial results and a note.
- Stopping is cooperative: no objective is hard-cancelled mid-attack, so artifacts are never torn.
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING

from ..data import Finding, Objective
from ..providers.base import ProviderError
from .budget import Budget
from .budget import build_budget as build_budget

if TYPE_CHECKING:  # pragma: no cover - typing only
    from ..attacker.run_result import AttemptRecord, RunResult
    from ..config import CampaignConfig, Config

# run_one returns the objective's finding (or None) plus its attempt transcript
RunOne = Callable[[Objective], Awaitable["tuple[Finding | None, list[AttemptRecord]]"]]

_BASE_DELAY_S = 0.1
_MAX_BACKOFF_S = 2.0
# a longer Retry-After is capped, so one objective cannot hold a campaign for minutes
_MAX_RETRY_AFTER_S = 30.0


def retry_delay(tries: int, retry_after: float | None = None,
                rand: Callable[[], float] = random.random) -> float:
    """Seconds to wait before retry number `tries`.

    Exponential backoff with jitter, or the provider's Retry-After when that is longer (capped).
    """
    ceiling = min(_BASE_DELAY_S * 2**tries, _MAX_BACKOFF_S)
    # half fixed, half random, so objectives that failed together do not retry in lockstep
    delay = ceiling / 2 + rand() * ceiling / 2
    if retry_after is not None:
        delay = max(delay, min(retry_after, _MAX_RETRY_AFTER_S))
    return delay


async def execute_campaign(*, config: Config, objectives: list[Objective], run_one: RunOne,
                           result: RunResult, budget: Budget,
                           emit: Callable[[str], None] = lambda _m: None) -> None:
    """Schedule every objective and aggregate findings/attempts into `result`.

    `run_one` runs the full single-objective loop and consults `budget` per strategy. This function
    owns concurrency, the stop condition, retries, and per-objective error isolation.
    """
    campaign = config.campaign
    objectives = _cap_objectives(objectives, campaign.budget.max_objectives, result)
    gate = asyncio.Semaphore(max(1, campaign.concurrency))
    # set when a stop condition fires; prevents new objectives from starting
    stop = asyncio.Event()

    async def worker(objective: Objective) -> None:
        # cooperative stop checks happen before acquiring the gate so queued work exits cheaply
        if _skip_before_start(objective, stop, budget, result):
            return
        async with gate:
            if stop.is_set():
                result.notes.append(f"skipped '{objective.title}': stop condition reached")
                return
            emit(f"objective: {objective.title}")
            outcome = await _run_isolated(run_one, objective, campaign.retries, emit, result)
            _record_outcome(outcome, campaign, budget, result, stop, emit)

    await asyncio.gather(*(worker(o) for o in objectives))


def _cap_objectives(objectives: list[Objective], max_objectives: int | None,
                    result: RunResult) -> list[Objective]:
    """max_objectives caps how many objectives are scheduled at all."""
    if max_objectives is None:
        return objectives
    if len(objectives) > max_objectives:
        result.notes.append(
            f"objective budget: running {max_objectives} of {len(objectives)} objectives"
        )
    return objectives[:max_objectives]


def _skip_before_start(objective: Objective, stop: asyncio.Event, budget: Budget,
                       result: RunResult) -> bool:
    if stop.is_set():
        result.notes.append(f"skipped '{objective.title}': stop condition reached")
        return True
    exhausted, why = budget.exhausted()
    if exhausted:
        stop.set()
        result.notes.append(f"skipped '{objective.title}': {why}")
    return exhausted


def _record_outcome(outcome: tuple[Finding | None, list[AttemptRecord]],
                    campaign: CampaignConfig, budget: Budget, result: RunResult,
                    stop: asyncio.Event, emit: Callable[[str], None]) -> None:
    finding, records = outcome
    result.objectives_run += 1
    result.attempts.extend(records)
    if finding is not None:
        result.findings.append(finding)
        if campaign.stop_on == "first_finding":
            stop.set()
            emit("stop condition: first finding reached; not starting further objectives")
    if campaign.stop_on == "budget" and budget.exhausted()[0]:
        stop.set()


async def _run_isolated(run_one: RunOne, objective: Objective, retries: int,
                        emit: Callable[[str], None],
                        result: RunResult) -> tuple[Finding | None, list[AttemptRecord]]:
    """Run one objective with error isolation and bounded retries on transient errors only."""
    tries = 0
    while True:
        try:
            return await run_one(objective)
        except ProviderError as e:
            # permanent: trying again would fail the same way
            if not e.retryable:
                msg = (f"objective '{objective.title}' failed (not retried, it would fail "
                       f"again): {e}")
                result.notes.append(msg)
                emit(msg)
                return None, []
            if tries >= retries:
                msg = f"objective '{objective.title}' failed after {tries + 1} attempt(s): {e}"
                result.notes.append(msg)
                emit(msg)
                return None, []
            tries += 1
            emit(f"retry {tries}/{retries} for '{objective.title}' after a transient error: {e}")
            await asyncio.sleep(retry_delay(tries, e.retry_after))
        except Exception as e:  # non-transient: isolate, never retry, never kill the campaign
            msg = f"objective '{objective.title}' errored (not retried): {e}"
            result.notes.append(msg)
            emit(msg)
            return None, []
