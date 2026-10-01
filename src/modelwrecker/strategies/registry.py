"""Strategy registry: look strategies up by name.

Built-in strategies register here. New strategies plug in without the core loop changing (the plugin
system in docs/architecture/PLUGIN-SYSTEM.md will add entry-point discovery later).
"""

from __future__ import annotations

from .base import BaseStrategy
from .direct import DirectJailbreak
from .extraction import PromptExtraction

_REGISTRY: dict[str, type[BaseStrategy]] = {
    DirectJailbreak.name: DirectJailbreak,
    PromptExtraction.name: PromptExtraction,
}


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
        })
    return out


def register(cls: type[BaseStrategy]) -> None:
    _REGISTRY[cls.name] = cls
