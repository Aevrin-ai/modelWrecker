# Final test report

> Snapshot from 2026-10-01, Phase 4. Superseded by [`docs/testing/test-matrix.md`](../docs/testing/test-matrix.md).

Date: 2026-10-01. Phase: 4 (minimum engine). Legend: PASS / FAIL / BLOCKED / NOT TESTED.

## Executive summary

The modelWrecker local engine core is implemented and verified offline. The full pipeline - config ->
planner -> strategy -> target -> judge -> reliability -> evidence -> finding -> report - runs end to end,
including a real run over HTTP against a loopback stub that speaks the OpenAI chat-completions wire
format (the same code path used for OpenRouter and Ollama). 58 automated tests pass with no network and
no API key.

Live provider testing (OpenRouter / Ollama), MCP, Docker, and PyPI packaging are **not yet tested** and
are honestly marked NOT TESTED. Nothing untested is claimed as passing.

## Environment

- OS: Windows 11. Python 3.12.9. pydantic 2.11, httpx, typer, pyyaml present.
- Test command: `.venv\Scripts\python -m pytest -q` -> 58 passed.

## What was verified (PASS)

- Config loading/validation, protocol and unknown-key rejection, env-only secrets.
- Authorization gate: an unauthorized target is refused before any request.
- Security: egress guard blocks loopback/link-local/RFC1918/metadata; redaction strips secret fields.
- Provider: OpenAI-compatible adapter parses the wire format; real HTTP round-trip produced a finding.
- Strategies: direct_jailbreak, prompt_extraction, best_of_n, prefill, many_shot, crescendo,
  encoded_jailbreak, and PyRIT-backed pyrit_send/pyrit_pair/pyrit_tap (10 total).
- Judge: multi-signal ensemble + calibration (0 false positives on benign fixtures).
- Reliability: replay labelled a repeated success `reliable` (5/5).
- Findings/evidence/storage: finding created with verified taxonomy (OWASP LLM07/LLM08, ATLAS
  AML.T0057); evidence + JSONL event log + SQLite index written with tight permissions.
- CLI: `version`, `strategies`, `init`, `validate`, `check` work; errors return exit code 2 with useful
  messages (missing file, unauthorized target, bad protocol).
- All four `examples/*.yaml` validate.
- Packaging: `pip install .` in a fresh virtual environment succeeds and the `modelwrecker` console
  script runs (`--help`, `version`, `validate`, `strategies`).

## Live results (PASS)

- OpenRouter connectivity via `provider test` (installed CLI): PASS ("Pong", ~0.9 s, tokens reported).
- Engine `run_config` against OpenRouter `openai/gpt-4o-mini`: PASS, 3 objectives across both strategies.
  The model **resisted** all of them (no secret leak, no rule break), so **0 findings** - a valid result
  and, importantly, the judge produced **no false positive** on a robust model.
- Installed `modelwrecker run` against OpenRouter: PASS (ran, judged, rendered a report, exit 0).
- The finding/evidence/reliability path itself is verified by the real-HTTP stub run, where a
  deliberately vulnerable target produced a correct, reproducible critical finding (5/5 replays).

## Harness integration and packaging (PASS)

- MCP server (`modelwrecker mcp`) builds and passes a real MCP client round-trip over in-memory streams:
  tool discovery plus a live tool call. Guardrails verified: only safe tools are exposed (no
  shell/file/http), an unauthorized target is rejected before any run, and path-traversal / out-of-scope
  run ids are rejected.
- Wheel: `uv build` produces a wheel that installs in a fresh venv, contains the `findings`/`evidence`/
  `mcp` packages, and the wheel-installed CLI ran a full loop against a loopback stub - a critical finding,
  3/3 replays. 36 offline tests pass.

## Phase 5 strategies + report (PASS)

- Four new strategies, tested offline: `best_of_n`, `prefill`, `many_shot`, `crescendo` (plus the Phase 4
  `direct_jailbreak`, `prompt_extraction`). Six strategies total.
- Reports now include a full **attempt transcript**: for every attempt, the exact prompt sent to the
  model, the model's reply, and the result (SUCCESS / PARTIAL / FAILED with score). Verified for both a
  success and a refusal.

## Docker (PASS)

- `docker build` succeeds. The container runs as a **non-root** user (uid 10001), lists all six
  strategies, validates a mounted config, and runs a **full attack loop in-container** against a host
  stub - producing a reliable critical finding (3/3 replays) with the transcript rendered.
- Security: non-root verified; no Docker socket mounted; run with `--add-host` only. Resource limits and
  no-privileged are documented in `docs/workflows/DEPLOYMENT.md`.

## PyRIT 1.1 integration + Phase 6 payload engine (PASS)

- A clean `.venv` (uv) with the `attacks` extra pulls **PyRIT 1.1.0**, which imports fine (the earlier
  0.6.0/termcolor breakage was an environment issue, resolved by the fresh venv).
- Our provider is bridged into a PyRIT target (`strategies/pyrit_bridge.py`); `pyrit_send`, `pyrit_pair`
  (PAIR), `pyrit_tap` (TAP) run through PyRIT. **PAIR runs offline end to end to a SUCCESS outcome**; TAP
  executes (prunes offline without a live adversarial model, a valid outcome). Registered only when the
  extra is installed.
- Payload engine: 6 first-party transforms (base64/rot13/reverse/zero_width/leetspeak/homoglyph) with
  chains and reversible round-trips, plus PyRIT converters (morse/binary/leetspeak) wrapped as transforms.
  New `encoded_jailbreak` strategy and `transforms` CLI command.
- Also fixed in the clean venv: migrated the MCP server to the MCP SDK v2 `MCPServer` (the venv resolves
  mcp 2.x).

## Not tested yet (NOT TESTED)

- Live Ollama run - not run in this environment.
- Direct OpenAI/Anthropic adapters - not implemented (anthropic raises a clear "not implemented" error).
- any-llm multiplexer adapter - currently falls back to the OpenAI-compatible wire.
- garak strategies, campaign engine, PyPI publish.

## Definition of done (this phase)

- [x] Core engine works
- [x] CLI works
- [x] YAML works (all examples validate)
- [x] At least one real provider works (OpenRouter, live)
- [x] Every implemented provider tested or marked (OpenAI-compatible PASS; others NOT TESTED/not implemented)
- [x] Every implemented strategy tested (direct_jailbreak, prompt_extraction)
- [x] At least one complete real attack campaign works (stub: finding; OpenRouter: ran, resisted)
- [x] Judge works; findings work; evidence works
- [x] Reliability/replay works
- [x] MCP works; MCP guardrails work
- [x] Docker works - build + in-container full attack loop
- [x] Docker security verified - non-root; no socket/privileged by default
- [x] Live tests have cost limits (small model, low rounds/replays, printed caps)
- [x] Documentation matches reality
- [x] YAML examples actually executed/validated
- [x] Python package installs cleanly; wheel builds and runs
- [x] Clean-environment test passes
- [x] No API key in source, logs, artifacts, or git
- [x] Known failures/limitations documented
- [x] Final test report exists
- [x] A user can independently create and run a YAML campaign (see getting-started)

## Failures found and fixed during this phase

- **Packaging bug (found by running the installed CLI, not by reading code):** `modelwrecker run` crashed
  in a clean-venv install with `ModuleNotFoundError: No module named 'modelwrecker.findings'`. Root cause:
  `.gitignore` listed `evidence/` and `findings/` (to ignore run artifacts), and hatchling honors
  `.gitignore` when selecting wheel files, so it excluded the **source** packages
  `src/modelwrecker/evidence/` and `src/modelwrecker/findings/` - which also meant they were not being
  git-staged. Fix: root-anchored those ignore patterns (`/evidence/`, `/findings/`, `/runs/`,
  `/sessions/`). After the fix, the reinstall includes both packages and the live CLI run works.
- Pydantic re-wraps a validator's `ConfigError` as `ValidationError` on direct model construction; the
  test now asserts on `ValueError` (the shared base). The clean `ConfigError` surface is still guaranteed
  at the `load_config` boundary.
- Mermaid parse error from parentheses in subgraph titles (pre-existing doc bug) fixed.

## Known limitations

- Only the OpenAI-compatible provider is implemented; other adapters are stubs or raise clearly.
- `replay` currently prints the stored reproduction payload; full re-execution wiring lands with live
  testing.
- `report` renders markdown; SARIF/HTML are planned.

## Final status

**Phases 4-6 + PyRIT + harness + Docker: PASS - verified offline and live.** The engine, the installed
CLI, a real OpenRouter provider, the wheel, the MCP harness server, and the Docker image all work end to
end, including a full in-container attack loop (one real packaging bug found and fixed). Reports show the
prompt sent, the model reply, and pass/fail per attempt. **PyRIT 1.1 is integrated** (PAIR runs offline to
SUCCESS) and the **payload engine** (first-party + PyRIT converters) is in. Direct OpenAI/Anthropic
adapters, any-llm, garak, the campaign engine, Ollama, and PyPI publish remain NOT TESTED. Full detail in
`docs/testing/test-matrix.md`. 58 offline tests pass.

## API key rotation

The provided OpenRouter key was used only via the `OPENROUTER_API_KEY` environment variable. A full scan
of the repo, git content, and run artifacts found it nowhere. Even so, because it was shared in chat,
**rotate (revoke and regenerate) the OpenRouter key now** as a precaution.
