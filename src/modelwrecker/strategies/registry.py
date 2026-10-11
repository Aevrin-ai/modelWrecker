"""Strategy registry: look strategies up by name.

Built-in strategies register here. New strategies plug in without the core loop changing (the plugin
system in docs/architecture/PLUGIN-SYSTEM.md will add entry-point discovery later).
"""

from __future__ import annotations

from .base import BaseStrategy
from .best_of_n import BestOfN
from .crescendo import Crescendo
from .direct import DirectJailbreak
from .encoded import EncodedJailbreak
from .extraction import PromptExtraction
from .indirect_injection import IndirectPromptInjection
from .many_shot import ManyShot
from .mcp_poisoning import McpToolPoisoning
from .memory_poisoning import MemoryPoisoning
from .multi_agent_injection import MultiAgentInjection
from .multimodal_injection import MultimodalInjection
from .prefill import Prefill
from .rag_injection import RagInjection
from .supply_chain import SupplyChainInjection
from .tool_misuse import ToolMisuse

_REGISTRY: dict[str, type[BaseStrategy]] = {
    DirectJailbreak.name: DirectJailbreak,
    PromptExtraction.name: PromptExtraction,
    BestOfN.name: BestOfN,
    Prefill.name: Prefill,
    ManyShot.name: ManyShot,
    Crescendo.name: Crescendo,
    EncodedJailbreak.name: EncodedJailbreak,
    ToolMisuse.name: ToolMisuse,
    RagInjection.name: RagInjection,
    SupplyChainInjection.name: SupplyChainInjection,
    IndirectPromptInjection.name: IndirectPromptInjection,
    MemoryPoisoning.name: MemoryPoisoning,
    MultiAgentInjection.name: MultiAgentInjection,
    MultimodalInjection.name: MultimodalInjection,
    McpToolPoisoning.name: McpToolPoisoning,
}

# PyRIT-backed strategies (PAIR/TAP/send) register only when a working PyRIT is importable, so the
# engine runs fine without the optional `modelwrecker[attacks]` dependency. See ADR-0006.
from .pyrit_adapter import pyrit_available  # noqa: E402

if pyrit_available()[0]:
    from .pyrit_attacks import PyRITPair, PyRITPromptSending, PyRITTap  # noqa: E402
    from .pyrit_xpia import PyRITXpia  # noqa: E402

    for _cls in (PyRITPromptSending, PyRITPair, PyRITTap, PyRITXpia):
        _REGISTRY[_cls.name] = _cls

# garak-backed strategy registers only when the optional `modelwrecker[scan]` dependency is
# importable.
from .garak_adapter import garak_available  # noqa: E402

if garak_available()[0]:
    from .garak_probe import GarakProbe  # noqa: E402

    _REGISTRY[GarakProbe.name] = GarakProbe


def get_strategy(name: str) -> BaseStrategy:
    cls = _REGISTRY.get(name)
    if cls is None:
        raise KeyError(f"unknown strategy {name!r}; known: {sorted(_REGISTRY)}")
    return cls()


def list_strategies() -> list[dict]:
    out = []
    for name, cls in sorted(_REGISTRY.items()):
        out.append({
            "name": name,
            "version": cls.version,
            "required_capabilities": sorted(c.value for c in cls.required_target_capabilities),
            "taxonomy": [f"{r.framework}:{r.id}" for r in cls.candidate_taxonomy],
            "spec": cls.spec.as_dict(),
        })
    return out


def register(cls: type[BaseStrategy]) -> None:
    _REGISTRY[cls.name] = cls
