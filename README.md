# modelWrecker

**An AI red teaming engine.** It safely attacks AI systems - LLMs, chatbots, agents, RAG
pipelines, and MCP-connected tools - to find security weaknesses before real attackers do, and
turns each confirmed weakness into a **reproducible finding** mapped to standard security
taxonomies (OWASP LLM Top 10, OWASP Agentic, OWASP MCP Top 10, MITRE ATLAS).

> **Status: Phase 4 (minimum engine) in progress.** The design, threat model, interfaces, and decisions
> are complete, and the package is scaffolded (data models, config, interfaces, the security layer,
> taxonomy, and a CLI skeleton, with a passing offline test suite). The attack loop and concrete
> adapters are being wired next. See [`ROADMAP.md`](ROADMAP.md).

> **For authorized testing only.** Use modelWrecker on systems you own or have explicit written
> permission to test.

## What makes it different

- **Three clean roles.** An **attacker** that decides what to try, a **target** that is tested,
  and a **judge** that decides if an attack worked - kept strictly separate.
- **Adaptive, not a prompt dump.** A planner selects and mutates strategies based on what the
  target does, instead of firing a fixed list.
- **Findings you can trust.** A single success is replayed and scored; only verified, reliable
  results become findings, each with full reproduction evidence.
- **Secure by design.** Auth-by-default, host tools off by default, egress filtering, secret
  redaction, sandboxed execution - the opposite of a localhost tool with hidden RCE.
- **Free and self-hostable.** Runs end-to-end on local models (Ollama / vLLM). Paid model APIs
  are optional, never required.

## Design goals

Modular, low-maintenance, and reusable as the AI red-teaming layer of the Aevrin platform. New
strategies, providers, targets, judges, and transforms plug in behind interfaces without touching
the core engine.

## Where to start reading

- [`CLAUDE.md`](CLAUDE.md) - the project rules and reading order.
- [`docs/index.md`](docs/index.md) - the full documentation map.
- [`docs/architecture/OVERVIEW.md`](docs/architecture/OVERVIEW.md) - how the whole thing fits together.
- [`docs/security/SECURITY.md`](docs/security/SECURITY.md) - the security model.

## License

Apache-2.0 (planned). See [`docs/decisions/ADR-0002-license.md`](docs/decisions/ADR-0002-license.md).
modelWrecker does **not** reuse AGPL-licensed red-team source code; prior tooling informed the design only.