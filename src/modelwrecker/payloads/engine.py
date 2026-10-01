"""PayloadEngine: apply, chain, and decode transforms.

The planner decides whether to use this; it is never mandatory (ADR-0009). Every applied transform is
recorded so a finding can be reproduced exactly.
"""

from __future__ import annotations

from .registry import apply_chain, get_transform, list_transforms


class PayloadEngine:
    def transform(self, payload: str, name: str, **params: object) -> str:
        return get_transform(name).apply(payload, **params)

    def chain(self, payload: str, chain: list[str]) -> str:
        return apply_chain(payload, chain)

    def decode(self, payload: str, chain: list[str]) -> str:
        """Decode a reversible chain in reverse order (raises if any step is not reversible)."""
        out = payload
        for name in reversed(chain):
            out = get_transform(name).decode(out)
        return out

    def available(self) -> list[dict]:
        return list_transforms()
