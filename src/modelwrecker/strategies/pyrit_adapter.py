"""PyRIT availability check (ADR-0006).

PyRIT (MIT) is reused behind our Strategy interface. The actual wrappers live in `pyrit_attacks.py`
(PAIR, TAP, prompt-sending) and the provider bridge in `pyrit_bridge.py`. This module only reports
whether a working PyRIT (1.1+) is importable, so the registry can register the PyRIT strategies when the
optional `modelwrecker[attacks]` dependency is installed and skip them cleanly when it is not.
See docs/decisions/ADR-0006-reuse-pyrit-garak.md.
"""

from __future__ import annotations


def pyrit_available() -> tuple[bool, str]:
    """Return (ok, detail). ok is True only if a working PyRIT (1.1+) can be imported."""
    try:
        import pyrit  # noqa: F401
        from pyrit.converter import Base64Converter  # noqa: F401  (1.1 module path)
        from pyrit.executor.attack import PAIRAttack, TAPAttack  # noqa: F401
    except Exception as e:  # ImportError or a broken transitive dep
        return False, f"PyRIT not usable: {e}"
    return True, "PyRIT import OK"