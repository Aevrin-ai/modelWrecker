"""garak availability + probe loading (ADR-0006).

garak (Apache-2.0, NVIDIA) is reused behind our Strategy interface as a source of attack prompts: we
load a garak probe's prompts and send them at our own target, then judge with OUR judge (the judge
stays ours, never garak's, to keep the attacker/target/judge split). The strategy lives in
`garak_probe.py` and registers only when the optional `modelwrecker[scan]` dependency is importable.
See docs/decisions/ADR-0006-reuse-pyrit-garak.md.
"""

from __future__ import annotations


def garak_available() -> tuple[bool, str]:
    """Return (ok, detail). ok is True only if garak can be imported."""
    try:
        import garak  # noqa: F401
        import garak.probes  # noqa: F401
    except Exception as e:  # ImportError or a broken transitive dep
        return False, f"garak not usable: {e}"
    return True, "garak import OK"


def load_probe_prompts(probe_name: str, limit: int = 20) -> list[str]:
    """Load a garak probe and return up to `limit` of its attack prompts.

    `probe_name` is a garak dotted path like "latentinjection.LatentInjectionFactSnippetEiffel" or a
    short "module.Class". Raises if garak is missing or the probe cannot load; caller handles it.
    """
    import importlib

    module, _, cls = probe_name.rpartition(".")
    if not module:
        raise ValueError(f"probe name must be 'module.Class', got {probe_name!r}")
    mod = importlib.import_module(f"garak.probes.{module}")
    probe = getattr(mod, cls)()
    prompts = list(getattr(probe, "prompts", []) or [])
    # garak prompts may be plain strings or small dict/turn structures; coerce to text.
    out: list[str] = []
    for p in prompts[: max(1, limit)]:
        if isinstance(p, str):
            out.append(p)
        elif isinstance(p, dict):
            out.append(str(p.get("text") or p.get("prompt") or p))
        else:
            out.append(str(p))
    return out
