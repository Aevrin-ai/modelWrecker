# ADR-0003 - Provider abstraction

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Define a **thin internal `Provider` interface** (`generate`/`stream`/`count_tokens`/`capabilities`/
`health_check`/`aclose`). Ship direct adapters: **OpenAI**, **Anthropic**, and one **OpenAI-compatible**
adapter (covers Ollama, vLLM, OpenRouter, Azure OpenAI, Groq, Together via `base_url`).

Adopt **any-llm** (Mozilla, Apache-2.0) as the **default multiplexer** behind the interface, so one
adapter reaches many providers without a hosted proxy. The direct OpenAI / Anthropic / OpenAI-compatible
adapters remain first-class and are the fallback that needs no multiplexer at all. Other gateways
(LiteLLM, Portkey) stay **optional** adapters, never a hard dependency. The architecture must stay fully
functional with direct SDKs and local models alone.

## Why
- The engine must not care which provider is underneath and must run fully local.
- any-llm is a **library, not a proxy**: no hosted service, Apache-2.0, actively released, and it wraps
  the official SDKs instead of re-implementing wire protocols. That gives broad provider coverage at a low
  maintenance cost while keeping everything self-hostable.
- A gateway *service* that sits on every provider credential is a high-value supply-chain target -
  demonstrated by the **LiteLLM Mar-2026 incident** (malicious PyPI versions stole credentials). Using a
  library multiplexer (any-llm) plus pinned lockfiles avoids standing up such a service, and LiteLLM
  stays optional and pinned if anyone wants it.

## Alternatives
- **Direct SDKs only** - fewer dependencies, but we would hand-write or stub many providers; any-llm gives
  the breadth for free behind our interface.
- **Depend on LiteLLM** - rejected as a hard dependency (enterprise split + supply-chain risk + heavier).
- **Hand-write every wire protocol** (the approach taken by naive harnesses) - more code, more
  maintenance, and it tends toward a client-leak bug across many call sites.

## Trade-offs
- any-llm becomes a core dependency, so its churn and transitive deps are ours to track - mitigated by
  keeping it behind our interface (swap to direct SDKs anytime) and pinning via `uv.lock`. The direct
  adapters guarantee the engine still works if any-llm is ever removed.
