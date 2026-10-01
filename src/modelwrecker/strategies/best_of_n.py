"""Best-of-N: send the same ask several times and keep the strongest reply.

Useful against stochastic targets: a model that refuses once may comply on another sample. The engine
loop judges each attempt and keeps the best (see docs/attack-engine/STRATEGIES.md).
"""

from __future__ import annotations

from ..data import TaxonomyRef
from ..interfaces import Capability
from .base import BaseStrategy, StrategyContext, StrategyResult, StrategyRun


class BestOfN(BaseStrategy):
    name = "best_of_n"
    version = "1"
    required_target_capabilities = {Capability.SEND_MESSAGE}
    candidate_taxonomy = [
        TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2026"),
        TaxonomyRef(framework="mitre_atlas", id="AML.T0054"),
    ]

    async def run(self, ctx: StrategyContext) -> StrategyResult:
        n = max(1, int((ctx.params or {}).get("n", 3)))
        payload = ctx.objective.description or ctx.objective.title
        runs: list[StrategyRun] = []
        for i in range(1, n + 1):
            ctx.emit(f"[{self.name}] sample {i}/{n}")
            attempt = self._attempt(ctx, payload)
            obs = await ctx.target.send_message(payload, temperature=1.0)
            obs.attempt_id = attempt.id
            runs.append(StrategyRun(attempt=attempt, observation=obs))
        return StrategyResult(runs=runs, note=f"best of {n}")
