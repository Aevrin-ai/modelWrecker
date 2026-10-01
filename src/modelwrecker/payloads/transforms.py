"""First-party payload transforms.

Each transform is a small, well-understood string operation. Reversible transforms implement `decode`.
These are owned in-tree (ADR-0009) and kept deliberately simple; more can be added as plugins, and PyRIT
converters are available through `pyrit_converters.py` when the attacks extra is installed.
"""

from __future__ import annotations

import base64
import codecs

_ZWSP = "​"  # zero-width space

# Homoglyph map: a few Latin letters -> visually similar Unicode letters.
_HOMOGLYPHS = {"a": "а", "e": "е", "o": "о", "p": "р", "c": "с", "x": "х"}
_LEET = {"a": "4", "e": "3", "i": "1", "o": "0", "s": "5", "t": "7"}


class Transform:
    """Base transform. Subclasses set name/reversible and implement apply (+ decode if reversible)."""

    name: str = "base"
    version: str = "1"
    reversible: bool = False

    def apply(self, payload: str, **params: object) -> str:  # pragma: no cover - abstract
        raise NotImplementedError

    def decode(self, payload: str, **params: object) -> str:
        if not self.reversible:
            raise ValueError(f"transform {self.name!r} is not reversible")
        raise NotImplementedError


class Base64Transform(Transform):
    name = "base64"
    reversible = True

    def apply(self, payload: str, **params: object) -> str:
        return base64.b64encode(payload.encode("utf-8")).decode("ascii")

    def decode(self, payload: str, **params: object) -> str:
        return base64.b64decode(payload.encode("ascii")).decode("utf-8")


class Rot13Transform(Transform):
    name = "rot13"
    reversible = True

    def apply(self, payload: str, **params: object) -> str:
        return codecs.encode(payload, "rot_13")

    def decode(self, payload: str, **params: object) -> str:
        return codecs.decode(payload, "rot_13")


class ReverseTransform(Transform):
    name = "reverse"
    reversible = True

    def apply(self, payload: str, **params: object) -> str:
        return payload[::-1]

    def decode(self, payload: str, **params: object) -> str:
        return payload[::-1]


class ZeroWidthTransform(Transform):
    name = "zero_width"
    reversible = True

    def apply(self, payload: str, **params: object) -> str:
        return _ZWSP.join(payload)

    def decode(self, payload: str, **params: object) -> str:
        return payload.replace(_ZWSP, "")


class LeetspeakTransform(Transform):
    name = "leetspeak"
    reversible = False  # lossy

    def apply(self, payload: str, **params: object) -> str:
        return "".join(_LEET.get(ch.lower(), ch) for ch in payload)


class HomoglyphTransform(Transform):
    name = "homoglyph"
    reversible = False  # lossy

    def apply(self, payload: str, **params: object) -> str:
        return "".join(_HOMOGLYPHS.get(ch.lower(), ch) for ch in payload)


_BUILTINS = [
    Base64Transform, Rot13Transform, ReverseTransform,
    ZeroWidthTransform, LeetspeakTransform, HomoglyphTransform,
]
