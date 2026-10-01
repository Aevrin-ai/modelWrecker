# Final test report

Date: 2026-10-01. Phase: 4 (minimum engine). Legend: PASS / FAIL / BLOCKED / NOT TESTED.

## Executive summary

The modelWrecker local engine core is implemented and verified offline. The full pipeline - config ->
planner -> strategy -> target -> judge -> reliability -> evidence -> finding -> report - runs end to end,
including a real run over HTTP against a loopback stub that speaks the OpenAI chat-completions wire
format (the same code path used for OpenRouter and Ollama). 30 automated tests pass with no network and
no API key.

Live provider testing (OpenRouter / Ollama), MCP, Docker, and PyPI packaging are **not yet tested** and
are honestly marked NOT TESTED. Nothing untested is claimed as passing.

## Environment

- OS: Windows 11. Python 3.12.9. pydantic 2.11, httpx, typer, pyyaml present.
- Test command: `PYTHONPATH=src python -m pytest -q` -> 30 passed.

## What was verified (PASS)

- Config loading/validation, protocol and unknown-key rejection, env-only secrets.
- Authorization gate: an unauthorized target is refused before any request.
- Security: egress guard blocks loopback/link-local/RFC1918/metadata; redaction strips secret fields.
- Provider: OpenAI-compatible adapter parses the wire format; real HTTP round-trip produced a finding.
- Strategies: `direct_jailbreak`, `prompt_extraction` run through the loop.
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

## Blocked

- Docker: the image build could not run because the Docker daemon is not running in this environment. The
  `Dockerfile` and `.dockerignore` are written (non-root user, mcp extra, `/work` workdir). Marked BLOCKED,
  not PASS.

## Not tested yet (NOT TESTED)

- Live Ollama run - not run in this environment.
- Direct OpenAI/Anthropic adapters - not implemented (anthropic raises a clear "not implemented" error).
- any-llm multiplexer adapter - currently falls back to the OpenAI-compatible wire.
- PyRIT/garak strategies, payload engine, campaign engine, PyPI publish.

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
- [ ] Docker works - BLOCKED (daemon not running); Dockerfile ready
- [ ] Docker security verified - BLOCKED
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

**Phase 4 local engine core + harness integration: PASS - verified offline and live.** The engine, the
installed CLI, a real OpenRouter provider, the wheel, and the MCP harness server all work end to end
(one real packaging bug found and fixed). Docker is BLOCKED (daemon not running; Dockerfile ready).
Direct provider adapters and the later-phase features remain NOT TESTED and are marked as such. Full
detail in `docs/testing/test-matrix.md`.

## API key rotation

The provided OpenRouter key was used only via the `OPENROUTER_API_KEY` environment variable. A full scan
of the repo, git content, and run artifacts found it nowhere. Even so, because it was shared in chat,
**rotate (revoke and regenerate) the OpenRouter key now** as a precaution.
