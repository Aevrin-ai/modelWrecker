"""Direct single-shot jailbreak: send the objective's ask straight at the target.

The simplest strategy and the Phase 4 baseline. It sends one payload and returns the result; the loop
judges it. Maps to prompt injection / jailbreak taxonomy entries.
"""

from __future__ import annotations

from ..data import TaxonomyRef
from ..interfaces import Capability
from .base import BaseStrategy, StrategyContext, StrategyResult, StrategyRun


class DirectJailbreak(BaseStrategy):
    name = "direct_jailbreak"
    version = "1"
    required_target_capabilities = {Capability.SEND_MESSAGE}
    candidate_taxonomy = [
        TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2026"),
        TaxonomyRef(framework="mitre_atlas", id="AML.T0054"),
    ]

    async def run(self, ctx: StrategyContext) -> StrategyResult:
        payload = ctx.objective.description or ctx.objective.title
        ctx.emit(f"[{self.name}] sending direct payload")
        attempt = self._attempt(ctx, payload)
        obs = await ctx.target.send_message(payload)
        obs.attempt_id = attempt.id
        return StrategyResult(runs=[StrategyRun(attempt=attempt, observation=obs)], note="single-shot")
