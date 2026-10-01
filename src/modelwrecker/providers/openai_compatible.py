"""OpenAI-compatible provider adapter.

Talks to any endpoint that speaks the OpenAI Chat Completions wire format: OpenRouter, Ollama, vLLM,
Groq, Together, Azure OpenAI, and OpenAI itself. This is the self-hostable baseline (see
docs/providers/OVERVIEW.md). One adapter, many providers, selected by `base_url`.
"""

from __future__ import annotations

import time

import httpx

from .base import BaseProvider, Completion, ProviderCapabilities, ProviderError, Usage

_DEFAULT_TIMEOUT = 120.0
_POOL = httpx.Limits(max_keepalive_connections=10, max_connections=50, keepalive_expiry=30.0)


class OpenAICompatibleProvider(BaseProvider):
    name = "openai_compatible"
    version = "1"

    def __init__(
        self,
        model: str,
        base_url: str,
        api_key: str | None = None,
        timeout: float | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(model)
        self.base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout = timeout or _DEFAULT_TIMEOUT
        self._extra_headers = extra_headers or {}
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            headers = {"Content-Type": "application/json", **self._extra_headers}
            if self._api_key:
                headers["Authorization"] = f"Bearer {self._api_key}"
            self._client = httpx.AsyncClient(timeout=self._timeout, limits=_POOL, headers=headers)
        return self._client

    async def generate(self, messages: list[dict], **params: object) -> Completion:
        body: dict = {"model": self.model, "messages": messages}
        # Only pass through known, safe params.
        for k in ("max_tokens", "temperature", "top_p", "stop"):
            if k in params and params[k] is not None:
                body[k] = params[k]
        url = f"{self.base_url}/chat/completions"
        client = self._get_client()
        start = time.perf_counter()
        try:
            resp = await client.post(url, json=body)
        except httpx.TimeoutException as e:
            raise ProviderError(f"timeout calling {url}: {e}") from e
        except httpx.HTTPError as e:
            raise ProviderError(f"network error calling {url}: {e}") from e
        latency = int((time.perf_counter() - start) * 1000)

        if resp.status_code >= 400:
            # Keep the provider's error text (trimmed) but never leak our own auth header.
            detail = resp.text[:500]
            raise ProviderError(f"HTTP {resp.status_code} from {self.base_url}: {detail}")

        try:
            data = resp.json()
        except ValueError as e:
            raise ProviderError(f"non-JSON response from {self.base_url}: {resp.text[:200]}") from e

        return _parse_chat_completion(data, latency, self.model)

    def capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(streaming=True, tools=True, reasoning=True)

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


def _parse_chat_completion(data: dict, latency_ms: int, model: str) -> Completion:
    try:
        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        text = message.get("content") or ""
        # Some providers (reasoning models) expose a separate reasoning field.
        reasoning = message.get("reasoning") or message.get("reasoning_content") or ""
        tool_calls = message.get("tool_calls") or []
    except (AttributeError, IndexError, TypeError) as e:
        raise ProviderError(f"unexpected response shape: {e}") from e

    usage_raw = data.get("usage") or {}
    usage = Usage(
        prompt_tokens=int(usage_raw.get("prompt_tokens", 0) or 0),
        completion_tokens=int(usage_raw.get("completion_tokens", 0) or 0),
        total_tokens=int(usage_raw.get("total_tokens", 0) or 0),
    )
    return Completion(
        text=text if isinstance(text, str) else str(text),
        reasoning=reasoning if isinstance(reasoning, str) else "",
        tool_calls=tool_calls if isinstance(tool_calls, list) else [],
        usage=usage,
        latency_ms=latency_ms,
        http_status=200,
        model=data.get("model") or model,
        raw={},  # raw body intentionally not stored here; evidence layer captures redacted copies
    )
