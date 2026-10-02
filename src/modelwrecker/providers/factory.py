"""Build providers from config, and own their lifecycle.

`provider_scope()` tracks every provider built inside it and closes them once at the boundary, so
strategies/tools never leak HTTP clients (see docs/providers/OVERVIEW.md, client lifecycle).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar

from ..config import Endpoint
from ..security.egress import EgressPolicy
from .base import BaseProvider, ProviderError
from .openai_compatible import OpenAICompatibleProvider

# Protocols that are served by the OpenAI-compatible wire adapter today. any_llm is the documented
# default multiplexer; until the any-llm SDK adapter lands it falls back to the OpenAI-compatible
# wire, which already reaches OpenRouter/Ollama/vLLM/OpenAI (see ADR-0003).
_OPENAI_WIRE = {"openai", "openai_compatible", "any_llm", "openrouter", "litellm", "portkey"}

_bucket: ContextVar[list[BaseProvider] | None] = ContextVar("mw_provider_bucket", default=None)


def build_provider(endpoint: Endpoint, egress: EgressPolicy | None = None) -> BaseProvider:
    """Build a provider for an endpoint. Tracked for close if inside a provider_scope().

    `egress` is the run's policy from `security.egress`; without one the strict default applies.
    """
    if endpoint.protocol in _OPENAI_WIRE:
        base_url = endpoint.base_url or _default_base_url(endpoint.protocol)
        if not base_url:
            raise ProviderError(
                f"protocol {endpoint.protocol!r} needs a base_url "
                "(e.g. an OpenRouter or Ollama URL)"
            )
        provider: BaseProvider = OpenAICompatibleProvider(
            model=endpoint.model,
            base_url=base_url,
            api_key=endpoint.resolve_key(),
            timeout=endpoint.timeout,
            egress=egress,
        )
    elif endpoint.protocol == "anthropic":
        raise ProviderError(
            "direct 'anthropic' adapter is not implemented yet; use 'openai_compatible' "
            "(Anthropic via an OpenAI-compatible gateway) or 'any_llm'"
        )
    else:
        raise ProviderError(f"unknown protocol {endpoint.protocol!r}")

    b = _bucket.get()
    if b is not None:
        b.append(provider)
    return provider


def _default_base_url(protocol: str) -> str | None:
    if protocol in ("openai",):
        return "https://api.openai.com/v1"
    if protocol in ("openrouter",):
        return "https://openrouter.ai/api/v1"
    return None


@asynccontextmanager
async def provider_scope() -> AsyncIterator[None]:
    """Close every provider built inside this block, once, on exit."""
    bucket: list[BaseProvider] = []
    token = _bucket.set(bucket)
    try:
        yield
    finally:
        _bucket.reset(token)
        for p in bucket:
            try:
                await p.aclose()
            except Exception:
                pass
