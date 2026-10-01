"""Wrap PyRIT converters as modelWrecker transforms (ADR-0006 reuse).

PyRIT ships a large, deterministic converter library (morse, binary, caesar, ...). We expose a few behind
our Transform interface, so the payload engine gains them for free when the attacks extra is installed.
PyRIT converters are async; since transforms run inside the engine's async loop, we bridge to them on a
worker thread with its own event loop.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor

from .transforms import Transform

# Map our transform name -> PyRIT converter class name in pyrit.converter.
_PYRIT_MAP = {
    "pyrit_morse": "MorseConverter",
    "pyrit_binary": "BinaryConverter",
    "pyrit_caesar": "CaesarConverter",
    "pyrit_leetspeak": "LeetspeakConverter",
}


def _run_sync(coro):
    """Run an async coroutine to completion even when called from within a running event loop."""
    with ThreadPoolExecutor(max_workers=1) as ex:
        return ex.submit(lambda: asyncio.run(coro)).result()


class _PyRITConverterTransform(Transform):
    reversible = False  # treated as one-way for our purposes

    def __init__(self, name: str, converter) -> None:
        self.name = name
        self.version = "1"
        self._converter = converter

    def apply(self, payload: str, **params: object) -> str:
        result = _run_sync(self._converter.convert_async(prompt=payload, input_type="text"))
        return getattr(result, "output_text", str(result))


def pyrit_transforms() -> list[Transform]:
    """Build the PyRIT-backed transforms. Returns [] if PyRIT or a converter is unavailable."""
    import pyrit.converter as conv

    out: list[Transform] = []
    for name, cls_name in _PYRIT_MAP.items():
        cls = getattr(conv, cls_name, None)
        if cls is None:
            continue
        try:
            out.append(_PyRITConverterTransform(name, cls()))
        except Exception:
            continue
    return out
