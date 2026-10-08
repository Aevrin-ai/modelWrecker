# modelWrecker

**An AI red teaming engine.** It safely attacks AI systems - LLMs, chatbots, agents, RAG
pipelines, and MCP-connected tools - to find security weaknesses before real attackers do, and
turns each confirmed weakness into a **reproducible finding** mapped to standard security
taxonomies (OWASP LLM Top 10, OWASP Agentic, OWASP MCP Top 10, MITRE ATLAS).

> **Status: alpha, working end to end.** The local engine runs full campaigns against chat, agent, RAG,
> and simulated MCP tool targets: adaptive attack strategies (including PyRIT and garak behind adapters), a
> multi-signal judge, replay-based reliability checks, evidence, reports, and analytics. It is live-tested
> against OpenRouter and covered by an offline test suite. An optional hosted dashboard at
> <https://app.aevrin.net> receives run summaries from a signed-in install; the engine works fully
> without it. See the [roadmap](https://github.com/Aevrin-ai/modelWrecker/blob/main/ROADMAP.md) and the
> [test matrix](https://github.com/Aevrin-ai/modelWrecker/blob/main/docs/testing/test-matrix.md) for
> exactly what is built and tested.

## Install and run

```bash
pip install modelwrecker
modelwrecker init my.yaml        # write a starter config, then edit it
modelwrecker validate my.yaml    # check it before spending anything
modelwrecker run my.yaml         # attack, verify, and write a report under runs/
```

> **For authorized testing only.** Use modelWrecker on systems you own or have explicit written
> permission to test.

## What makes it different

- **Three clean roles.** An **attacker** that decides what to try, a **target** that is tested,
  and a **judge** that decides if an attack worked - kept strictly separate.
- **Adaptive, not a prompt dump.** A planner selects and mutates strategies based on what the
  target does, instead of firing a fixed list.
- **Findings you can trust.** A single success is replayed and scored; only verified, reliable
  results become findings, each with full reproduction evidence.
- **Secure by design.** No network listener in the engine, host tools off by default, an egress guard
  on every model request, and secret redaction in logs and evidence - the opposite of a localhost tool
  with hidden RCE.
- **Free and self-hostable.** Designed to run end to end on local models (Ollama / vLLM through their
  OpenAI-compatible API; not live-tested yet). Paid model APIs are optional, never required.

## Design goals

Modular, low-maintenance, and reusable as the AI red-teaming layer of the Aevrin platform. New
strategies, providers, targets, judges, and transforms plug in behind interfaces without touching
the core engine.

## Where to start reading

- [`CLAUDE.md`](https://github.com/Aevrin-ai/modelWrecker/blob/main/CLAUDE.md) - the project rules and reading order.
- [`docs/index.md`](https://github.com/Aevrin-ai/modelWrecker/blob/main/docs/index.md) - the full documentation map.
- [`docs/architecture/OVERVIEW.md`](https://github.com/Aevrin-ai/modelWrecker/blob/main/docs/architecture/OVERVIEW.md) - how the whole thing fits together.
- [`docs/security/SECURITY.md`](https://github.com/Aevrin-ai/modelWrecker/blob/main/docs/security/SECURITY.md) - the security model.

## License

Apache-2.0 (planned). See [`docs/decisions/ADR-0002-license.md`](https://github.com/Aevrin-ai/modelWrecker/blob/main/docs/decisions/ADR-0002-license.md).
modelWrecker does **not** reuse AGPL-licensed red-team source code; prior tooling informed the design only.