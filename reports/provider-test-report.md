# Provider test report

> Snapshot from 2026-10-01, Phase 4. Superseded by [`docs/testing/test-matrix.md`](../docs/testing/test-matrix.md).

Date: 2026-10-01. Engineering compatibility report (not a model or provider ranking). No API key is
included anywhere in this report. Legend: PASS / NOT TESTED.

## OpenRouter (protocol: openai_compatible)

- Model tested: `openai/gpt-4o-mini`
- Requests: a handful of small, cost-capped requests (connectivity + two short campaigns)

| Check | Status | Notes |
|-------|--------|-------|
| Authentication | PASS | bearer key from `OPENROUTER_API_KEY` accepted |
| Connection | PASS | reachable over HTTPS |
| Basic generation | PASS | `provider test` returned "Pong"; latency ~0.9-1.2 s |
| Token usage | PASS | prompt/completion token counts returned and recorded |
| Error handling | PASS (unit) | adapter raises a clean `ProviderError` on HTTP >= 400 and on timeout; a live 4xx was not force-triggered |
| Streaming | NOT TESTED | streaming not implemented in the adapter yet |
| Tool calling | NOT TESTED | not exercised in this phase |
| Timeout / retry | NOT TESTED (live) | timeout path is coded; not force-triggered against the live API |
| Model discovery | NOT TESTED | `/models` listing not implemented |

Verified via: `modelwrecker provider test` (installed CLI, clean venv), the engine `run_config`, and the
installed `modelwrecker run` command - all against OpenRouter.

## Other providers

| Provider | Status | Notes |
|----------|--------|-------|
| Ollama (local) | NOT TESTED | same openai_compatible adapter; not run in this environment |
| vLLM (local) | NOT TESTED | same adapter |
| OpenAI (direct) | NOT TESTED | reachable via openai_compatible; direct SDK adapter not implemented |
| Anthropic (direct) | NOT TESTED | direct adapter not implemented (raises a clear "not implemented" error) |
| any-llm multiplexer | NOT TESTED | falls back to the openai_compatible wire today |

## Key handling

The API key was provided only through the `OPENROUTER_API_KEY` environment variable for the duration of
the test commands. A full-tree scan found the key in no source file, config, report, run artifact, or git
content. See the rotation note at the end of `reports/final-test-report.md`.
