"""PyRIT integration seam (ADR-0006).

The plan is to reuse PyRIT orchestrators (PAIR, TAP, Crescendo) and its scorers/memory behind our
Strategy interface. This module is the seam for that.

Status: NOT TESTED / not active. PyRIT is an optional dependency (`modelwrecker[attacks]`). In the
current environment PyRIT 0.6.0 fails to import (a broken `termcolor` transitive dependency), so this
adapter is intentionally inert rather than shipping untested, possibly-broken integration code. When a
working PyRIT (1.1+) is available, this is where the orchestrator wrappers go, converting PyRIT results
into our Attempt/Observation/Verdict shapes. See docs/decisions/ADR-0006-reuse-pyrit-garak.md.
"""

from __future__ import annotations


def pyrit_available() -> tuple[bool, str]:
    """Return (ok, detail). ok is True only if a working PyRIT can be imported."""
    try:
        import pyrit  # noqa: F401
        from pyrit.prompt_converter import Base64Converter  # noqa: F401
    except Exception as e:  # ImportError or a broken transitive dep
        return False, f"PyRIT not usable: {e}"
    return True, "PyRIT import OK"


# No strategies are registered from here yet, on purpose: we do not expose an untested integration.
# The first-party strategies (best_of_n, prefill, many_shot, crescendo) cover the Phase 5 techniques
# that can be verified today.