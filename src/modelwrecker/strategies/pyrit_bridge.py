"""Bridge modelWrecker providers into PyRIT, so PyRIT attack executors can drive our targets.

PyRIT (MIT) is reused behind our Strategy interface (ADR-0006). This module wraps a modelWrecker
provider as a PyRIT `PromptTarget` and converts a PyRIT `AttackResult` back into our shapes. PyRIT
is an optional dependency (`modelwrecker[attacks]`); import errors are handled by the caller.
"""

from __future__ import annotations

import asyncio
from typing import Any

from ..data import Attempt, Observation
from ..providers.base import BaseProvider

_PYRIT_READY = False
_INIT_LOCK = asyncio.Lock()


async def ensure_pyrit() -> None:
    """Initialize PyRIT once (in-memory store). Safe to call repeatedly."""
    global _PYRIT_READY
    if _PYRIT_READY:
        return
    async with _INIT_LOCK:
        if _PYRIT_READY:
            return
        from pyrit.setup import initialize_pyrit_async
        await initialize_pyrit_async("InMemory", silent=True)
        _PYRIT_READY = True


def make_target(
    provider: BaseProvider, system: str | None = None, *, multi_turn: bool = False
) -> Any:
    """Return a PyRIT PromptTarget that sends through a modelWrecker provider.

    `multi_turn=True` declares the multi-turn / editable-history / system-prompt capabilities that
    multi-turn attacks (PAIR, TAP) require of their targets.
    """
    from pyrit.models import construct_response_from_request
    from pyrit.prompt_target.common.prompt_target import (
        PromptTarget,
        TargetCapabilities,
        TargetConfiguration,
    )

    config = None
    if multi_turn:
        config = TargetConfiguration(capabilities=TargetCapabilities(
            supports_multi_turn=True, supports_editable_history=True, supports_system_prompt=True))

    class _ModelWreckerTarget(PromptTarget):
        def __init__(self) -> None:
            super().__init__(custom_configuration=config)
            self._provider = provider
            self._system = system

        async def _send_prompt_to_target_async(self, *, normalized_conversation: list) -> list:
            messages: list[dict] = []
            if self._system:
                messages.append({"role": "system", "content": self._system})
            for msg in normalized_conversation:
                for piece in msg.message_pieces:
                    text = piece.converted_value or piece.original_value or ""
                    messages.append({"role": piece.role, "content": text})
            completion = await self._provider.generate(messages, max_tokens=512)
            request_piece = normalized_conversation[-1].message_pieces[-1]
            return [construct_response_from_request(
                request=request_piece, response_text_pieces=[completion.text or ""])]

    return _ModelWreckerTarget()


def make_threshold_scorer(judge_provider: BaseProvider, threshold: float = 0.7) -> Any:
    """Build the FloatScaleThresholdScorer that PAIR/TAP require, backed by a modelWrecker provider.

    Wraps a PyRIT SelfAskScaleScorer (using PyRIT's Tree-of-Attacks scale) in a threshold scorer,
    with the scale judge routed through our judge provider.
    """
    from pyrit.score import FloatScaleThresholdScorer, SelfAskScaleScorer

    # The scale judge is itself used multi-turn, so its target must declare those capabilities.
    inner = SelfAskScaleScorer.from_scale(chat_target=make_target(judge_provider, multi_turn=True))
    return FloatScaleThresholdScorer(scorer=inner, threshold=threshold)


def result_to_observation(result: Any, attempt: Attempt) -> Observation:
    """Convert a PyRIT AttackResult into our Observation."""
    text = ""
    last = getattr(result, "last_response", None)
    if last is not None:
        pieces = getattr(last, "message_pieces", None)
        if pieces:  # a Message with pieces
            text = pieces[-1].converted_value or pieces[-1].original_value or ""
        elif hasattr(last, "converted_value"):  # a MessagePiece
            text = last.converted_value or getattr(last, "original_value", "") or ""
        else:
            text = str(last)
    return Observation(
        attempt_id=attempt.id,
        response=text,
        target_meta={
            "pyrit_outcome": str(getattr(result, "outcome", "")),
            "executed_turns": getattr(result, "executed_turns", 0),
        },
    )
