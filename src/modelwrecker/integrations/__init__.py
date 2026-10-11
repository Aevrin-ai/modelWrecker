"""Compatibility layers for other red-team tools.

modelWrecker stays the engine. These adapters let a user bring config or ideas from another tool
without running a second engine. See docs/integrations/.
"""

from __future__ import annotations

from .promptfoo import (
    PROMPTFOO_PLUGINS,
    PROMPTFOO_STRATEGIES,
    PromptfooError,
    translate_promptfoo,
)

__all__ = [
    "PROMPTFOO_PLUGINS",
    "PROMPTFOO_STRATEGIES",
    "PromptfooError",
    "translate_promptfoo",
]
