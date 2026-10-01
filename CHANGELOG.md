# Changelog

All notable changes to modelWrecker are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Only record things that actually
happened - never invent historical entries.

## [Unreleased]

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

### Notes
- The attack engine loop and concrete adapters are not wired yet; the action CLI commands say so.
  This is Phase 4 in progress (see `ROADMAP.md`).