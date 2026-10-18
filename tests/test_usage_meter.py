"""Usage metering and the request / cost budget caps (offline, deterministic).

See docs/campaigns/OVERVIEW.md (budgets) and docs/providers/OVERVIEW.md (metering).
"""

from __future__ import annotations

import asyncio

from modelwrecker.campaigns.engine import Budget
from modelwrecker.providers.base import Completion, Usage
from modelwrecker.providers.fake import FakeProvider
from modelwrecker.providers.meter import Meter, MeteredProvider


def test_meter_counts_requests_tokens_and_cost_by_role() -> None:
    meter = Meter()
    target = MeteredProvider(FakeProvider("t", lambda m: "x" * 40), meter, "target",
                             price_in=1.0, price_out=2.0)
    judge = MeteredProvider(FakeProvider("j", lambda m: "ok"), meter, "judge")
    asyncio.run(target.generate([{"role": "user", "content": "hi"}]))
    asyncio.run(judge.generate([{"role": "user", "content": "hi"}]))
    summary = meter.summary()
    assert summary["requests"] == 2
    assert summary["by_role"]["target"]["requests"] == 1
    assert summary["by_role"]["judge"]["requests"] == 1
    # FakeProvider reports tokens, so the priced target costs something and the unpriced judge none
    assert summary["cost_usd"] > 0
    assert summary["by_role"]["judge"]["cost_usd"] == 0.0


def test_metered_provider_does_not_change_the_completion() -> None:
    inner = FakeProvider("t", lambda m: "hello")
    wrapped = MeteredProvider(inner, Meter(), "target")
    direct = asyncio.run(inner.generate([{"role": "user", "content": "hi"}]))
    via = asyncio.run(wrapped.generate([{"role": "user", "content": "hi"}]))
    assert isinstance(via, Completion) and via.text == direct.text


def test_budget_is_exhausted_by_requests_and_cost() -> None:
    meter = Meter()
    budget = Budget(max_requests=2, meter=meter)
    assert budget.exhausted()[0] is False
    meter.record("target", Completion(usage=Usage(prompt_tokens=1, completion_tokens=1)), 0, 0)
    meter.record("target", Completion(usage=Usage(prompt_tokens=1, completion_tokens=1)), 0, 0)
    assert budget.exhausted() == (True, "request budget exhausted")

    cost_budget = Budget(max_cost_usd=0.01, meter=Meter())
    assert cost_budget.exhausted()[0] is False
    cost_budget.meter.record(
        "target", Completion(usage=Usage(prompt_tokens=1000, completion_tokens=0)), 1.0, 0.0
    )  # 1000/1000 * $1 = $1 > $0.01
    assert cost_budget.exhausted() == (True, "cost budget exhausted")


def test_budget_without_a_meter_ignores_request_and_cost_caps() -> None:
    # A cap with no meter must never crash; it simply does not fire.
    budget = Budget(max_requests=1, max_cost_usd=0.0, meter=None)
    assert budget.exhausted()[0] is False
