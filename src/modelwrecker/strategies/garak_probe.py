"""garak-probe strategy: run a garak probe's prompts against our target, judged by our judge.

This reuses garak's large probe corpus (ADR-0006) without handing it the attacker/judge roles.
`probe` (garak dotted probe name) and `max_prompts` (cap). The loop judges each attempt as usual.
"""

from __future__ import annotations

from ..data import TaxonomyRef
from ..interfaces import Capability
from .base import BaseStrategy, StrategyContext, StrategyResult, StrategyRun

_DEFAULT_PROBE = "test.Test"  # garak's built-in no-model-needed probe; override via params["probe"]


async def send_prompts(ctx: StrategyContext, prompts: list[str]) -> StrategyResult:
    """Send each prompt at the target and collect the attempt/observation pairs.

    Factored out so the mapping (probe prompts to attempts/observations) is testable without garak.
    """
    runs: list[StrategyRun] = []
    for prompt in prompts:
        attempt = self_attempt(ctx, prompt)
        obs = await ctx.target.send_message(prompt)
        obs.attempt_id = attempt.id
        runs.append(StrategyRun(attempt=attempt, observation=obs))
    return StrategyResult(runs=runs, note=f"garak probe, {len(runs)} prompt(s)")


def self_attempt(ctx: StrategyContext, prompt: str):
    # small shim so send_prompts can build attempts without a BaseStrategy instance in tests
    from ..data import Attempt

    return Attempt(plan_id=ctx.plan_id, objective_id=ctx.objective.id, payload=prompt)


class GarakProbe(BaseStrategy):
    name = "garak_probe"
    version = "1"
    required_target_capabilities = {Capability.SEND_MESSAGE}
    candidate_taxonomy = [
        TaxonomyRef(framework="owasp_llm", id="LLM01", edition="2026"),
    ]

    async def run(self, ctx: StrategyContext) -> StrategyResult:
        from .garak_adapter import garak_available, load_probe_prompts

        ok, detail = garak_available()
        if not ok:
            ctx.emit(f"[{self.name}] {detail}; skipping")
            return StrategyResult(runs=[], note=detail)

        probe = str(ctx.params.get("probe", _DEFAULT_PROBE))
        limit = int(ctx.params.get("max_prompts", 20))
        try:
            prompts = load_probe_prompts(probe, limit=limit)
        except Exception as e:  # probe name wrong or garak internals changed
            ctx.emit(f"[{self.name}] could not load probe {probe!r}: {e}")
            return StrategyResult(runs=[], note=f"probe load failed: {e}")

        ctx.emit(f"[{self.name}] probe {probe}: {len(prompts)} prompt(s)")
        return await send_prompts(ctx, prompts)
