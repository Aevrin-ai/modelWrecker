"""Reliability: a success must be reproducible before it becomes a finding.

Re-fires the winning payload N times, judges each, and labels the result reliable / flaky /
does_not_hold (see docs/attack-engine/RELIABILITY.md).
"""

from __future__ import annotations

import asyncio
import math

from ..data import Confidence, Objective, Outcome, ReliabilityResult


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


async def measure_reliability(
    *,
    target,
    judge,
    objective: Objective,
    payload: str,
    attempt_id: str,
    n: int,
    threshold: float,
    backend_pinned: bool = False,
) -> ReliabilityResult:
    n = max(1, n)

    async def one() -> Outcome:
        obs = await target.send_message(payload)
        verdict = await judge.judge(obs, objective, payload)
        return verdict.outcome

    outcomes = await asyncio.gather(*[one() for _ in range(n)], return_exceptions=True)
    successes = sum(1 for o in outcomes if o is Outcome.SUCCESS)
    partials = sum(1 for o in outcomes if o is Outcome.PARTIAL)
    rate = successes / n

    if rate >= threshold:
        confidence = Confidence.RELIABLE
    elif successes > 0:
        confidence = Confidence.FLAKY
    else:
        confidence = Confidence.DOES_NOT_HOLD

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
        confidence=confidence,
        backend_pinned=backend_pinned,
    )
