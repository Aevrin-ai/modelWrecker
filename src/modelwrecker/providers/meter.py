"""Usage metering: count every model request, its tokens, and an estimated cost.

Live runs need request, time, and cost limits (docs/campaigns/OVERVIEW.md). Time and token caps
already exist; this adds a per-request count and a cost estimate across all three roles (attacker,
target, judge) and the reliability replays, by wrapping each provider. The meter is shared by one
run, so the campaign budget can stop the run when the request or cost cap is reached.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .base import BaseProvider, Completion, HealthStatus, ProviderCapabilities


@dataclass
class Meter:
    """Running totals for one run. Updated after each provider call (an await-free point)."""

    requests: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    by_role: dict = field(default_factory=dict)

    def record(self, role: str, completion: Completion, price_in: float, price_out: float) -> None:
        self.requests += 1
        self.input_tokens += completion.usage.prompt_tokens
        self.output_tokens += completion.usage.completion_tokens
        cost = (completion.usage.prompt_tokens / 1000.0) * price_in + (
            completion.usage.completion_tokens / 1000.0
        ) * price_out
        self.cost_usd += cost
        slot = self.by_role.setdefault(role, {"requests": 0, "cost_usd": 0.0})
        slot["requests"] += 1
        slot["cost_usd"] += cost

    def summary(self) -> dict:
        return {
            "requests": self.requests,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "cost_usd": round(self.cost_usd, 6),
            "by_role": {r: {"requests": v["requests"], "cost_usd": round(v["cost_usd"], 6)}
                        for r, v in self.by_role.items()},
        }


class MeteredProvider(BaseProvider):
    """Wraps a provider and records each generate() call in the shared meter.

    Cost is an estimate only: tokens x the per-1k prices set on the endpoint (0 when unset, so cost
    stays 0 unless the operator provides prices). It never changes what is sent to the model.
    """

    def __init__(self, inner: BaseProvider, meter: Meter, role: str,
                 price_in: float = 0.0, price_out: float = 0.0) -> None:
        super().__init__(inner.model)
        self._inner = inner
        self._meter = meter
        self._role = role
        self._price_in = price_in
        self._price_out = price_out
        self.name = inner.name
        self.version = inner.version

    async def generate(self, messages: list[dict], **params: object) -> Completion:
        completion = await self._inner.generate(messages, **params)
        self._meter.record(self._role, completion, self._price_in, self._price_out)
        return completion

    async def count_tokens(self, messages: list[dict]) -> int:
        return await self._inner.count_tokens(messages)

    def capabilities(self) -> ProviderCapabilities:
        return self._inner.capabilities()

    async def health_check(self) -> HealthStatus:
        return await self._inner.health_check()

    async def aclose(self) -> None:
        await self._inner.aclose()
