"""Attack planner: decide which strategy/strategies to try for an objective.

The planner is the attacker's brain in code form. It does NOT let the provider choose the attack
(see docs/attack-engine/ATTACK-PLANNER.md). If the user names a strategy, it respects it; otherwise
it picks an order based on the objective category.
"""

from __future__ import annotations

from ..config import Config
from ..data import Objective
from ..strategies.registry import get_strategy

# Which strategies to try, in order, for an objective category when strategy == "auto".
_AUTO_ORDER: dict[str, list[str]] = {
    "system_prompt_leak": ["prompt_extraction", "direct_jailbreak"],
    "pii_leak": ["prompt_extraction", "direct_jailbreak"],
    "sensitive_info": ["prompt_extraction", "direct_jailbreak"],
    # Phase 9 target-specific categories. A strategy whose required capability the target lacks is
    # skipped by the loop, so listing several here is safe across target types.
    "tool_misuse": ["tool_misuse"],
    "excessive_agency": ["tool_misuse"],
    "agent_hijack": ["tool_misuse"],
    "rag_injection": ["rag_injection"],
    "indirect_injection": ["rag_injection"],
    "data_exfiltration": ["rag_injection", "prompt_extraction", "direct_jailbreak"],
    "mcp_tool_poisoning": ["mcp_tool_poisoning", "tool_misuse"],
    "tool_poisoning": ["mcp_tool_poisoning", "tool_misuse"],
}
_AUTO_DEFAULT = ["direct_jailbreak", "prompt_extraction"]


class Planner:
    def select_sequence(self, objective: Objective, config: Config) -> list[str]:
        chosen = (config.attack.strategy if config.attack else "auto") or "auto"
        if chosen != "auto":
            get_strategy(chosen)  # validate it exists; raises KeyError with a clear message
            seq = [chosen]
        else:
            seq = _AUTO_ORDER.get(objective.category, _AUTO_DEFAULT)
        max_rounds = config.engine.max_rounds
        return seq[:max_rounds] if max_rounds > 0 else seq

    def rationale(self, objective: Objective, config: Config, strategy: str) -> str:
        if config.attack and config.attack.strategy not in (None, "auto"):
            return f"operator selected strategy {strategy!r}"
        return f"auto-selected {strategy!r} for objective category {objective.category!r}"
