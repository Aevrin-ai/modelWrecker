"""Transform registry: look transforms up by name and apply chains.

Built-in first-party transforms register here. PyRIT converters register too when the attacks extra is
installed (see pyrit_converters). New transforms plug in without the engine changing.
"""

from __future__ import annotations

from .transforms import _BUILTINS, Transform

_REGISTRY: dict[str, Transform] = {cls.name: cls() for cls in _BUILTINS}


def _maybe_register_pyrit() -> None:
    # The engine must run without the optional attacks extra, so any PyRIT failure means "no PyRIT
    # transforms", never a crashed run.
    try:
        from .pyrit_converters import pyrit_transforms

        transforms = pyrit_transforms()
    except Exception:
        return
    for t in transforms:
        _REGISTRY.setdefault(t.name, t)


_maybe_register_pyrit()


def get_transform(name: str) -> Transform:
    t = _REGISTRY.get(name)
    if t is None:
        raise KeyError(f"unknown transform {name!r}; known: {sorted(_REGISTRY)}")
    return t


def list_transforms() -> list[dict]:
    return [{"name": t.name, "version": t.version, "reversible": t.reversible}
            for t in sorted(_REGISTRY.values(), key=lambda x: x.name)]


def apply_chain(payload: str, chain: list[str]) -> str:
    """Apply transforms in order. Each entry is a transform name."""
    out = payload
    for name in chain:
        out = get_transform(name).apply(out)
    return out
