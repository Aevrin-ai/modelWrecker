"""Target base types and errors. See docs/targets/OVERVIEW.md."""

from __future__ import annotations


class UnsupportedCapability(Exception):
    """Raised when a target is asked to do something it does not support."""

