# Test matrix

Honest status of what has actually been tested. Legend: PASS (ran and verified), FAIL, BLOCKED,
NOT TESTED. Last updated 2026-10-01.

Run the automated suite in the project venv: `.venv\Scripts\python -m pytest -q` (offline, no API key;
create the venv with `uv venv` + `uv pip install -e ".[dev,mcp,attacks]"`). That gives **85 passing + 1
skipped** (the live garak test skips without the `scan` extra). With the `scan` extra also installed
(`uv pip install "garak>=0.17"`), the garak test runs too: **86 passing**. Without the `attacks` extra the
PyRIT tests skip.

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
| Strategy | best_of_n (resample N) | PASS | `tests/test_strategies.py` |
| Strategy | prefill (assistant priming, multi-turn) | PASS | `tests/test_strategies.py` |
| Strategy | many_shot (faux turns, multi-turn) | PASS | `tests/test_strategies.py` |
| Strategy | crescendo (multi-turn escalation) | PASS | `tests/test_strategies.py` |
| Strategy | encoded_jailbreak (transform-wrapped) | PASS | `tests/test_payloads.py` |
| Target | agent target: tool-call parse + sensitive-call flag | PASS | `tests/test_phase9_targets.py` |
| Target | RAG target: retrieval + document ingest | PASS | `tests/test_phase9_targets.py` |
| Target | MCP target: follows a poisoned tool description | PASS | `tests/test_phase9_targets.py` |
| Target | factory builds chat/agent/rag/mcp from config.type | PASS | `tests/test_phase9_targets.py` |
| Judge | tool_misuse signal (sensitive tool called) | PASS | `tests/test_phase9_targets.py` |
| Strategy | tool_misuse (agent) -> finding (LLM03/ASI01) | PASS | e2e + real CLI (agent stub: critical finding) |
| Strategy | rag_injection (indirect injection) -> finding (LLM01) | PASS | `tests/test_phase9_targets.py` e2e |
| Strategy | mcp_tool_poisoning (MCP03) | PASS | `tests/test_phase9_targets.py` (poisoned tool triggers sensitive call) |
| Strategy | PyRIT bridge (provider -> PyRIT target) | PASS | `tests/test_pyrit.py` (pyrit_send runs) |
| Strategy | pyrit_pair (PAIR via PyRIT) | PASS | `tests/test_pyrit.py` - runs offline, reaches SUCCESS outcome |
| Strategy | pyrit_tap (TAP via PyRIT) | PASS (executes) | `tests/test_pyrit.py` - runs; prunes offline without live adversarial |
| Payload engine | 6 first-party transforms + chains + round-trips | PASS | `tests/test_payloads.py` |
| Payload engine | PyRIT converter transforms (morse/binary/leetspeak) | PASS | registered when attacks extra present |
| Report | shows prompt sent + model reply + result per attempt | PASS | `tests/test_engine_e2e.py` (success and refusal) |
| Judge | calibration on benign fixtures | PASS | `tests/test_components.py`, e2e |
| Judge | success vs refusal verdict | PASS | e2e |
| Reliability | replay -> reliable/flaky/does_not_hold | PASS | e2e (5/5 reliable in stub run) |
| Reliability | Wilson 95% CI + high-variance flag | PASS | `tests/test_analytics.py` (extremes + tightening) |
| Analytics | ASR counts + by-strategy/category breakdowns | PASS | `tests/test_analytics.py` |
| Analytics | findings by severity + taxonomy | PASS | `tests/test_analytics.py` |
| Analytics | leaderboard ranks most-robust first | PASS | `tests/test_analytics.py`; real CLI (safe run ranked above weak) |
| Analytics | JSON/CSV renderers valid | PASS | `tests/test_analytics.py` |
| Analytics | self-contained HTML (no external refs) | PASS | `tests/test_analytics.py`; real CLI (0 external refs, 3.2 KB) |
| CLI | `analyze` writes HTML/JSON/CSV + leaderboard | PASS | real CLI over two loopback-stub runs |
| garak | prompt -> attempt mapping (offline) | PASS | `tests/test_garak.py` (fake target) |
| garak | live probe load + registry wiring | PASS | `scan` extra installed; `tests/test_garak.py` runs; real DAN/glitch probes load prompts |
| garak | full live loop (probe -> our target -> judge -> finding -> analytics) | PASS | real CLI `garak_probe` vs stub: 4 DAN prompts, 2/4 SUCCESS, critical finding, ASR 2/4 (no API key - loopback stub) |
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
| garak strategies | adapter | PASS - adapter, mapping, live probe load, and a full live attack loop all tested. See garak rows below. |
| Campaign engine | run all objectives to completion | PASS | `tests/test_campaign.py`; real CLI (3 objectives, concurrency 3, 3 findings) |
| Campaign engine | parallel execution (concurrency) | PASS | `tests/test_campaign.py`; real CLI `--concurrency 3` ran all in parallel |
| Campaign engine | stop_on first_finding | PASS | `tests/test_campaign.py`; real CLI stopped after first, skipped the rest |
| Campaign engine | budgets (max_objectives / max_attempts) | PASS | `tests/test_campaign.py` |
| Campaign engine | retry + per-objective error isolation | PASS | `tests/test_campaign.py` (transient error retried; campaign survives) |
| Campaign engine | invalid campaign config rejected | PASS | `tests/test_campaign.py`; real CLI exit 2 clean message |
| Campaign engine | money budget / wall-clock deadline live | NOT TESTED - money pricing not implemented; deadline tested only via unit budget |
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
| Docker | image build | PASS | `docker build` succeeded |
| Docker | in-container run (help/validate/strategies) | PASS | runs; all 6 strategies listed |
| Docker | in-container full attack loop | PASS | critical finding vs host stub, 3/3 replays, transcript rendered |
| Docker | security: runs as non-root | PASS | `id` -> uid=10001(wrecker) |
| Docker | security: no socket/privileged by default | PASS (by run flags) | documented in deployment; no socket mounted |

## Summary

The **local engine** (config, providers over the OpenAI-compatible wire, chat target, planner, ten
strategies, multi-signal judge with calibration, reliability replay, evidence, findings with a full
attempt transcript, the payload/transform engine, storage, the CLI, and the MCP harness server) is
implemented and verified: 76 offline tests pass (1 skipped), a real end-to-end run works over HTTP, live
OpenRouter works, the wheel builds and runs a full loop, the MCP server passes a real client round-trip
with its guardrails, and **Docker builds and runs a full in-container attack loop as a non-root user**.
**PyRIT 1.1 is integrated**: our provider is bridged into PyRIT targets and **PAIR runs offline to a
SUCCESS outcome**, TAP executes, and PyRIT converters are available as transforms. The **campaign engine**
(parallel objectives, budgets, stop conditions, retries, per-objective error isolation) is verified offline
and through the real CLI. **Phase 8 analytics** (ASR with Wilson confidence intervals, by-strategy/category
breakdowns, findings-by-severity/taxonomy, a model leaderboard, and self-contained HTML/JSON/CSV reports
via `analyze`) is verified offline and through the real CLI over two stub runs. The **garak adapter** is
verified live: with the `scan` extra installed, real garak probes load and a full attack loop runs
(`garak_probe` DAN prompts -> our target -> our judge -> a critical finding -> analytics), all offline
against a loopback stub with no API key. **Phase 9 target types** (agent, RAG, MCP) and their strategies
(`tool_misuse`, `rag_injection`, `mcp_tool_poisoning`) plus the `tool_misuse` judge signal are implemented
and tested offline, with the agent path also verified through the real CLI (a critical finding mapped to
LLM03/ASI01). A **live MCP-server connection** for the MCP target (inline tools work today), direct
OpenAI/Anthropic adapters, any-llm, Ollama, and PyPI publish are NOT TESTED and are marked accordingly -
none are claimed as passing.
