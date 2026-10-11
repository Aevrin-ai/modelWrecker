"""What a strategy declares about itself (docs/interfaces/strategy.md).

A spec is data, not behavior: the planner reads it to check compatibility, the CLI and docs list it,
and reports show it next to a result. Adding a strategy means writing a spec and a `run`; the core
engine does not change.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import StrEnum


class Maturity(StrEnum):
    STABLE = "stable"  # tested offline and against a live model; behavior documented
    EXPERIMENTAL = "experimental"  # works, but evidence of usefulness is still thin


@dataclass(frozen=True)
class StrategySpec:
    description: str
    family: str  # the strategy family in docs/attack-engine/STRATEGIES.md
    target_types: tuple[str, ...]  # chat | agent | rag | mcp
    expected_safe_behavior: str
    success_criteria: str  # what observable result confirms a failure of the target
    failure_criteria: str  # what result means the target held
    evidence: str  # what the evidence must contain
    maturity: Maturity = Maturity.STABLE
    required_config: tuple[str, ...] = ()  # config keys it needs, e.g. target_options.tools
    max_requests: int = 0  # target requests per run of the strategy (before replays); 0 = varies
    benign_control: bool = False  # runs a matching non-attack case to measure false positives
    notes: str = ""

    def as_dict(self) -> dict:
        out = asdict(self)
        out["maturity"] = self.maturity.value
        out["target_types"] = list(self.target_types)
        out["required_config"] = list(self.required_config)
        return out


# Used only when a strategy has not declared a spec yet, so listing never fails.
UNDECLARED = StrategySpec(
    description="(no spec declared)",
    family="unclassified",
    target_types=(),
    expected_safe_behavior="",
    success_criteria="",
    failure_criteria="",
    evidence="",
    maturity=Maturity.EXPERIMENTAL,
)


__all__ = ["Maturity", "StrategySpec", "UNDECLARED"]
