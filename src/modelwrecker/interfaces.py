"""The contracts between the core engine and everything that plugs into it.

These Protocols mirror docs/interfaces/. Implementing one of these (plus declaring name/version) is all a
plugin needs; the core never imports a concrete adapter. Everything is async because the engine is
I/O-bound. Concrete adapters are added in later Phase 4 steps.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from enum import Enum
from typing import Protocol, runtime_checkable

from .data import Objective, Observation, ToolCall, Verdict


class Capability(str, Enum):
    """What a target supports. A target only exposes the ones it truly implements."""

    SEND_MESSAGE = "send_message"
    SEND_MULTITURN = "send_multiturn"
    UPLOAD_IMAGE = "upload_image"
    CALL_TOOL = "call_tool"
    OBSERVE_TOOL_CALL = "observe_tool_call"
    RESET_SESSION = "reset_session"
    GET_METADATA = "get_metadata"


@runtime_checkable
class Provider(Protocol):
    """Moves bytes to/from a model endpoint. No attack logic. See docs/interfaces/provider.md."""

    name: str
    version: str

    async def generate(self, messages: list[dict], **params: object) -> dict: ...
    def stream(self, messages: list[dict], **params: object) -> AsyncIterator[dict]: ...
    async def count_tokens(self, messages: list[dict]) -> int: ...
    def capabilities(self) -> dict: ...
    async def health_check(self) -> dict: ...
    async def aclose(self) -> None: ...


@runtime_checkable
class Target(Protocol):
    """The system under test. See docs/interfaces/target.md."""

    name: str
    version: str

    def capabilities(self) -> set[Capability]: ...
    async def get_metadata(self) -> dict: ...
    async def send_message(self, text: str, **opts: object) -> Observation: ...
    async def reset_session(self) -> None: ...


@runtime_checkable
class Strategy(Protocol):
    """One attack algorithm. See docs/interfaces/strategy.md.

    `run` takes a StrategyContext (defined by the engine at wiring time) and returns a StrategyResult.
    Typed loosely here to keep the scaffold import-light; the engine binds the concrete context.
    """

    name: str
    version: str
    required_target_capabilities: set[Capability]

    async def run(self, ctx: object) -> object: ...


@runtime_checkable
class JudgeSignal(Protocol):
    """One judge signal. See docs/interfaces/judge.md."""

    name: str
    version: str

    async def evaluate(self, obs: Observation, objective: Objective, payload: str) -> object: ...


@runtime_checkable
class VerdictCombiner(Protocol):
    def combine(self, signals: list[object], objective: Objective) -> Verdict: ...


@runtime_checkable
class Transform(Protocol):
    """One payload transform. Optional, planner-driven. See docs/interfaces/transform.md."""

    name: str
    version: str
    reversible: bool

    def apply(self, payload: str, **params: object) -> str: ...


__all__ = [
    "Capability",
    "Provider",
    "Target",
    "Strategy",
    "JudgeSignal",
    "VerdictCombiner",
    "Transform",
    "ToolCall",
]
