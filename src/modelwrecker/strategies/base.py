"""Strategy base types. See docs/attack-engine/STRATEGIES.md and docs/interfaces/strategy.md.

A strategy builds and sends attempts, returning the attempt+observation pairs. The engine loop
judges them and runs reliability; a strategy may also use ctx.judge for in-loop decisions
(multi-turn).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from ..data import Attempt, Objective, Observation, TaxonomyRef
from ..interfaces import Capability
from ..providers.base import BaseProvider
from .spec import UNDECLARED, StrategySpec


@dataclass
class StrategyContext:
    objective: Objective
    target: Any  # a Target (ChatTarget today)
    plan_id: str
    attacker: BaseProvider | None = None
    judge: Any | None = None  # the modelWrecker Judge (ensemble)
    judge_provider: BaseProvider | None = None  # raw judge provider (for e.g. PyRIT scorers)
    params: dict = field(default_factory=dict)  # strategy params from config.attack.params
    payloads: Any | None = None  # a PayloadEngine (transforms); may be None
    emit: Callable[[str], None] = field(default=lambda _m: None)


@dataclass
class StrategyRun:
    attempt: Attempt
    observation: Observation
    # a benign control (the scenario without the attack) is judged and reported, never a finding
    control: bool = False
    # re-runs this exact scenario for the reliability check; without it the payload is re-sent
    replay: Callable[[], Awaitable[Observation]] | None = None


@dataclass
class StrategyResult:
    runs: list[StrategyRun] = field(default_factory=list)
    note: str = ""


class BaseStrategy:
    name: str = "base"
    version: str = "0"
    required_target_capabilities: set[Capability] = {Capability.SEND_MESSAGE}
    candidate_taxonomy: list[TaxonomyRef] = []
    spec: StrategySpec = UNDECLARED

    async def run(self, ctx: StrategyContext) -> StrategyResult:  # pragma: no cover - abstract
        raise NotImplementedError

    def _attempt(self, ctx: StrategyContext, payload: str,
                 delivery: str = "single_turn") -> Attempt:
        return Attempt(
            plan_id=ctx.plan_id,
            objective_id=ctx.objective.id,
            payload=payload,
            delivery=delivery,
        )
