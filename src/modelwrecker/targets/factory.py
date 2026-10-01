"""Target factory: build the right target type from config.

`config.target.type` selects the target: chat (default), agent, rag, or mcp. Each target wraps a
provider and its own options (`target_options`). The engine attacks a Target behind one interface,
so adding a new target type does not change the loop. See docs/targets/OVERVIEW.md.
"""

from __future__ import annotations

from ..providers.base import BaseProvider
from .agent import AgentTarget
from .chat import ChatTarget
from .mcp_target import McpTarget
from .rag import RagTarget

_TYPES = {"chat": ChatTarget, "agent": AgentTarget, "rag": RagTarget, "mcp": McpTarget}


def build_target(endpoint, provider: BaseProvider):
    """Build a target from a target Endpoint and its provider."""
    kind = (endpoint.type or "chat").lower()
    if kind == "model":  # legacy/informational value means a plain chat model
        kind = "chat"
    cls = _TYPES.get(kind)
    if cls is None:
        raise ValueError(f"unknown target type {endpoint.type!r}; one of {sorted(_TYPES)}")
    if cls is ChatTarget:
        return ChatTarget(provider, system=endpoint.system)
    return cls(provider, system=endpoint.system, options=endpoint.target_options)
