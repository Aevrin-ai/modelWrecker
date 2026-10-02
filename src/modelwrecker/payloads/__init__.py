"""Payload/transform engine (Phase 6).

Transforms encode or obfuscate an attack payload (base64, rot13, zero-width, ...). They are optional
and planner-driven: most attempts send a plain payload. Transforms are independent of the attack
engine and of each other. See docs/attack-engine/PAYLOAD-ENGINE.md.
"""

from .engine import PayloadEngine
from .registry import apply_chain, get_transform, list_transforms

__all__ = ["PayloadEngine", "get_transform", "list_transforms", "apply_chain"]
