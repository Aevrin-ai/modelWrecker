# Changelog

All notable changes to modelWrecker are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Only record things that actually
happened - never invent historical entries.

## [Unreleased]

### Added (PyRIT activation + Phase 6 payload engine)
- **PyRIT 1.1 integrated** (`attacks` extra): a bridge wraps a modelWrecker provider as a PyRIT target
  (`strategies/pyrit_bridge.py`), and `strategies/pyrit_attacks.py` adds `pyrit_send`, `pyrit_pair`
  (PAIR), and `pyrit_tap` (TAP). PAIR runs offline end to end to a SUCCESS outcome; TAP executes. These
  register only when PyRIT imports, so the engine still runs without the extra.
- **Phase 6 payload engine**: first-party transforms (`base64`, `rot13`, `reverse`, `zero_width`,
  `leetspeak`, `homoglyph`) with chains + reversible round-trips, a `PayloadEngine`, and a registry; plus
  PyRIT converters (morse/binary/leetspeak, ...) wrapped as transforms when the `attacks` extra is present.
- New `encoded_jailbreak` strategy that applies a transform chain and records it on the attempt.
- CLI `transforms` command. Test suite grown to 58 (adds payload + PyRIT tests; PyRIT tests skip without
  the extra).

### Workflow
- Standardized on the project `.venv` via uv (`uv venv` + `uv pip install -e ".[dev,mcp,attacks]"`); do
  not pip-install into the global interpreter. Migrated the MCP server to the MCP SDK v2 `MCPServer`
  (the `.venv` resolves mcp 2.x).

### Added (Phase 5 + reporting + Docker)
- Four new attack strategies, tested offline: `best_of_n`, `prefill`, `many_shot`, `crescendo`.
  (The PyRIT adapter seam added here was activated later this cycle - see "PyRIT activation" above.)
- Reports now include a full **attempt transcript**: for every attempt, the exact prompt sent to the
  model, the model's reply, and the result (SUCCESS / PARTIAL / FAILED with score). `run` and `report`
  render it (md and json); the MCP `get_report` includes it too.
- Docker: image **built and verified** - runs as non-root, lists strategies, validates a mounted config,
  and runs a full in-container attack loop against a host stub (critical finding, 3/3 replays).
- Test suite grown to 44 passing offline tests (adds strategy + report-transcript tests).

### Changed
- Removed unused empty placeholder packages (`campaigns/`, `evidence/`); evidence capture lives in
  `findings/`. (`payloads/` was later re-added for Phase 6.) Repo-structure doc updated to match.

### Added
- Project memory and documentation system: `CLAUDE.md`, `docs/index.md`,
  `docs/DOCUMENTATION.md`, `docs/DEPENDENCIES.md`, `DECISIONS.md`, `ROADMAP.md`, this file.
- Phase 0 research notes under `docs/research/` (Aevrin, prior red-team harnesses and their audits, the OSS
  red-teaming and provider-gateway landscape, security taxonomies).
- Architecture documents under `docs/architecture/` and area docs for providers, targets,
  the attack engine, judges, campaigns, evidence/findings, and security.
- Thirteen ADRs under `docs/decisions/` covering language, license, provider abstraction, the
  attacker/target/judge split, the strategy plugin system, OSS reuse, the judge ensemble, the
  security model, the payload engine, the no-checksum-gate rule, storage, library-first design, and
  harness integration.
- Interface definitions (as documentation only) under `docs/interfaces/`.
- CLI, configuration, and environment reference under `docs/reference/`.
- `docs/reference/WRITING-STANDARD.md`: the project writing standard (simple English, no em dashes,
  no emoji, small Mermaid diagrams).
- `docs/features/` with the harness-integration feature (drive modelWrecker from Claude Code / Codex
  / any MCP client; ADR-0013).
- Phase 4 scaffolding: `pyproject.toml` (Apache-2.0, console script, dev tooling) and the
  `src/modelwrecker/` package - data models, config, interfaces (Protocols), the security layer
  (egress guard + redaction), taxonomy tables + validation, documented subpackage stubs, and a CLI
  skeleton. Offline test suite in `tests/` (19 passing).

### Changed
- Locked maintainer decisions: any-llm is the default provider multiplexer (ADR-0003); PyRIT reuse is
  a thin adapter plus its memory and scoring (ADR-0006); target order after chat is agent, RAG, then
  MCP; harness integration is in scope.
- Documentation style pass: removed internal spec references, converted em/en dashes to hyphens, and
  reframed all prior-tooling references as Aevrin design principles. Fixed the Mermaid parse error in
  `docs/architecture/OVERVIEW.md` (parentheses in subgraph titles).

### Added (engine implementation)
- Working local engine: OpenAI-compatible provider adapter (OpenRouter/Ollama/vLLM) with a provider
  factory and `provider_scope` lifecycle; a fake provider for offline tests.
- Chat target with an authorization gate (refuses targets not marked `authorized: true`).
- Attack planner + loop; two strategies (`direct_jailbreak`, `prompt_extraction`) with a registry.
- Multi-signal judge (LLM + secret + PII + rule) with a weighted combiner and calibration.
- Reliability replay; evidence capture; finding engine with severity + verified taxonomy; storage
  (atomic JSONL event log + SQLite index, tight file permissions).
- Real CLI: `init`, `validate`, `check`, `provider test`, `run`, `report`, `replay`, `strategies`.
- `examples/` (basic, openrouter, local-model, system-prompt) - all validated.
- `docs/getting-started/` (yaml, first-campaign), `docs/testing/test-matrix.md`, and
  `reports/final-test-report.md`.
- Test suite grown to 30 passing offline tests, plus a verified real-HTTP end-to-end run against a
  loopback stub (config -> finding -> evidence -> report).

### Added (harness integration + distribution)
- MCP server (`modelwrecker mcp`) exposing safe orchestration tools only (list_strategies,
  validate_config, run, get_findings, get_report, replay) behind a testable service layer, with
  guardrails (authorized-target-only, path-traversal rejection, no host tools). Verified by a real MCP
  client round-trip over in-memory streams. See ADR-0013 and `docs/features/harness-integration.md`.
- `Dockerfile` + `.dockerignore`: non-root image, installs the engine with the mcp extra (one engine,
  many distributions).
- Test suite grown to 36 passing offline tests (adds MCP service + round-trip tests).

### Verified live
- OpenRouter (`openai/gpt-4o-mini`) connectivity, engine run, and the installed CLI `run`/`provider test`
  all work end to end. The model resisted the benign test objectives (0 findings, no false positives);
  the finding/evidence/replay path is verified by a real-HTTP stub run with a vulnerable target.
- Packaging: `pip install .` in a clean venv works and the console script runs live. `uv build` produces
  a wheel that installs in a fresh venv and runs a full loop (critical finding vs a loopback stub).
- MCP server passes a real client round-trip with guardrails enforced.

### Fixed
- Packaging bug: `.gitignore` patterns `evidence/` and `findings/` also matched the source packages
  `src/modelwrecker/evidence/` and `src/modelwrecker/findings/` (hatchling honors `.gitignore`), so they
  were missing from the install and from git staging. Root-anchored the artifact ignore patterns.

### Notes
- (Superseded later this cycle: Docker was then built and verified; PyRIT and the payload engine were
  integrated.) Ollama local run, direct OpenAI/Anthropic adapters, any-llm/garak adapters, and the
  campaign engine remain NOT TESTED, marked as such in `docs/testing/test-matrix.md`. Nothing untested is
  claimed as passing.