"""Reliability: a success must be reproducible before it becomes a finding.

Re-fires the winning payload N times, judges each, and labels the result reliable / flaky /
does_not_hold (see docs/attack-engine/RELIABILITY.md).
"""

from __future__ import annotations

import asyncio
import math
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING

from ..data import Confidence, Objective, Observation, Outcome, ReliabilityResult

if TYPE_CHECKING:
    from ..interfaces import Target
    from ..judges.judge import Judge


def wilson_interval(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score 95% confidence interval for a success proportion.

    More honest than successes/n for small N (which is the red-team norm): it never returns a
    zero-width interval at 0 or 1 successes, so a "5/5 reliable" still shows real uncertainty.
    """
    if n <= 0:
        return (0.0, 0.0)
    p = successes / n
    denom = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denom
    margin = (z / denom) * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (max(0.0, center - margin), min(1.0, center + margin))


async def measure_reliability(*, target: Target, judge: Judge, objective: Objective,
                              payload: str, attempt_id: str, n: int, threshold: float,
                              backend_pinned: bool = False,
                              replay: Callable[[], Awaitable[Observation]] | None = None,
                              ) -> ReliabilityResult:
    """Replay a candidate attack `n` times and measure how often it really works.

    When a replay function is given, it re-runs the winning scenario (for example an
    indirect-injection tool session) instead of re-sending `payload`; the judge still decides each
    outcome.
    """
    n = max(1, n)

    async def one() -> Outcome:
        obs = await replay() if replay is not None else await target.send_message(payload)
        verdict = await judge.judge(obs, objective, payload)
        return verdict.outcome

    outcomes = await asyncio.gather(*[one() for _ in range(n)], return_exceptions=True)
    successes = sum(1 for o in outcomes if o is Outcome.SUCCESS)
    partials = sum(1 for o in outcomes if o is Outcome.PARTIAL)
    rate = successes / n
    ci_low, ci_high = wilson_interval(successes, n)

    return ReliabilityResult(
        attempt_id=attempt_id,
        attempts_run=n,
        successes=successes,
        partials=partials,
        success_rate=rate,
        ci_low=ci_low,
        ci_high=ci_high,
        high_variance=not backend_pinned,
        confidence=_confidence(rate, successes, threshold),
        backend_pinned=backend_pinned,
    )


def _confidence(rate: float, successes: int, threshold: float) -> Confidence:
    if rate >= threshold:
        return Confidence.RELIABLE
    if successes > 0:
        return Confidence.FLAKY
    return Confidence.DOES_NOT_HOLD
