"""Reliability: a success must be reproducible before it becomes a finding.

Re-fires the winning payload N times, judges each, and labels the result reliable / flaky /
does_not_hold (see docs/attack-engine/RELIABILITY.md).
"""

from __future__ import annotations

import asyncio

from ..data import Confidence, Objective, Outcome, ReliabilityResult


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

    return ReliabilityResult(
        attempt_id=attempt_id,
        attempts_run=n,
        successes=successes,
        partials=partials,
        success_rate=rate,
        confidence=confidence,
        backend_pinned=backend_pinned,
    )
