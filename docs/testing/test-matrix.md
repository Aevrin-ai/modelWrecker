# Test matrix

Honest status of what has actually been tested. Legend: PASS (ran and verified), FAIL, BLOCKED,
NOT TESTED. Last updated 2026-10-01.

Run the automated suite with: `PYTHONPATH=src python -m pytest -q` (30 tests, offline, no API key).

| Component | Test | Status | Evidence |
|-----------|------|--------|----------|
| Data models | round-trip via JSON | PASS | `tests/test_scaffold.py` |
| Config | unknown protocol / unknown key rejected | PASS | `tests/test_scaffold.py` |
| Config | key resolves from env, not file | PASS | `tests/test_scaffold.py` |
| Config | unauthorized target refused | PASS | `tests/test_engine_e2e.py` |
| Security | egress guard blocks loopback/private/metadata | PASS | `tests/test_scaffold.py` |
| Security | redaction strips keys/headers/PII fields | PASS | `tests/test_scaffold.py` |
| Taxonomy | unknown id rejected; titles filled | PASS | `tests/test_scaffold.py`, `tests/test_components.py` |
| Provider | OpenAI-compatible wire parsing | PASS | `tests/test_components.py` |
| Provider | real adapter over HTTP (loopback stub) | PASS | scratchpad `stub_run.py` (finding produced) |
| Provider | factory: anthropic not implemented -> clear error | PASS | `tests/test_components.py` |
| Strategy | registry load + unknown name error | PASS | `tests/test_components.py` |
| Strategy | direct_jailbreak | PASS (fake + stub) | e2e |
| Strategy | prompt_extraction | PASS (fake + stub) | e2e, stub_run |
| Judge | calibration on benign fixtures | PASS | `tests/test_components.py`, e2e |
| Judge | success vs refusal verdict | PASS | e2e |
| Reliability | replay -> reliable/flaky/does_not_hold | PASS | e2e (5/5 reliable in stub run) |
| Finding | severity scaling; taxonomy resolve | PASS | `tests/test_components.py` |
| Evidence | captured + stored, atomic write | PASS | stub_run (`evidence-*.json`) |
| Storage | JSONL events + SQLite index | PASS | stub_run (`events.jsonl`, `index.sqlite`) |
| CLI | version / strategies / init / validate / check | PASS | manual run |
| CLI | error handling (missing file, unauthorized, bad protocol) | PASS | manual run, exit code 2 |
| CLI | `provider test` (live OpenRouter) | PASS | returned "Pong", ~0.9 s, tokens reported |
| CLI | `run` against a live model (installed binary) | PASS | ran prompt_extraction vs gpt-4o-mini, report rendered |
| End-to-end | config -> finding -> evidence -> report | PASS | stub_run over real HTTP (vulnerable target) |
| End-to-end | config -> judged -> no false finding | PASS | live gpt-4o-mini resisted; judge scored 0, no finding |
| Live provider | OpenRouter (openai/gpt-4o-mini) | PASS | connectivity + 3 live objectives + installed CLI run |
| Live provider | Ollama (local) | NOT TESTED - not run in this environment |
| Packaging bug | source `findings/`+`evidence/` excluded by .gitignore (hatchling honors it) | FIXED | root-anchored the ignore patterns; reinstall includes them |
| Direct provider | OpenAI / Anthropic adapters | NOT TESTED - adapters not implemented yet (anthropic raises a clear error) |
| any-llm multiplexer | adapter | NOT TESTED - falls back to OpenAI-compatible wire today |
| PyRIT / garak strategies | adapters | NOT TESTED - not implemented yet (Phase 5/8) |
| Payload engine | transforms | NOT TESTED - not implemented yet (Phase 6) |
| Campaign engine | parallel/budgets | NOT TESTED - not implemented yet (Phase 7) |
| Harness integration | MCP server + JSON driver | PASS (built + tested); see MCP rows above |
| MCP server | builds; tools registered | PASS | `tests/test_mcp.py` |
| MCP server | real client round-trip (list_tools + call_tool) over in-memory streams | PASS | `tests/test_mcp.py` |
| MCP guardrails | only safe tools exposed (no shell/file/http) | PASS | round-trip asserts their absence |
| MCP guardrails | unauthorized target rejected before any run | PASS | `tests/test_mcp.py` |
| MCP guardrails | path traversal / out-of-scope run id rejected | PASS | `tests/test_mcp.py` |
| Packaging | `pip install .` in a clean venv | PASS | fresh venv install succeeded |
| Packaging | console script runs (--help/version/validate/strategies) | PASS | clean-env run |
| Packaging | `uv build` wheel + install in a fresh venv | PASS | wheel installs; contains findings/evidence/mcp |
| Packaging | wheel-installed CLI runs a full loop | PASS | critical finding vs loopback stub, 3/3 replays |
| Docker | image build | BLOCKED | Dockerfile written; Docker daemon not running in this environment |
| Docker | in-container run | BLOCKED | depends on the build |
| Docker | security (non-root etc.) | BLOCKED | image declares non-root user; not verifiable without a build |

## Summary

The **local engine core** (config, providers over the OpenAI-compatible wire, chat target, planner, two
strategies, multi-signal judge with calibration, reliability replay, evidence, findings, storage, the
CLI, and the MCP harness server) is implemented and verified: 36 offline tests pass, a real end-to-end
run works over HTTP, live OpenRouter works, the wheel builds and runs a full loop, and the MCP server
passes a real client round-trip with its guardrails. **Docker is BLOCKED** (the daemon is not running in
this environment; the Dockerfile is written and ready). Direct OpenAI/Anthropic adapters, any-llm,
PyRIT/garak, the payload and campaign engines, Ollama, and PyPI publish are NOT TESTED and are marked
accordingly - none are claimed as passing.
