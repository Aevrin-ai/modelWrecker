# ADR-0022 - Promptfoo interop by a one-way config translator, not a second engine

- **Status:** Accepted
- **Date:** 2026-10-11

## Decision
modelWrecker does not run, bundle, or shell out to Promptfoo. It provides a one-way Python config
translator (`modelwrecker import-promptfoo`) that reads the `redteam` section of a Promptfoo config and
writes a modelWrecker config. The run then uses modelWrecker's own engine, judge, reliability, budgets,
and authorization. Static encodings (base64, rot13, leetspeak, homoglyph) are re-expressed with our own
payload transforms, which already exist. Any Promptfoo plugin or strategy that is remote-only,
deprecated, or has no modelWrecker equivalent is rejected by name, never silently dropped.

## Why
- Promptfoo is MIT (copying would be legal), but it is a Node app (`node >=22.22.0`), and the
  agent-security plugins we care about most (indirect prompt injection, mcp, bola, bfla, rag-poisoning,
  ssrf) and the best strategies (goat, hydra, goblin, meta, gcg) are REMOTE-ONLY: they call
  `api.promptfoo.app`. Embedding them would add a Node runtime and a mandatory hosted dependency, which
  breaks the local-first and no-mandatory-SaaS rules and would create a second engine.
- modelWrecker already runs those agent attacks locally, so the native path is the product's strength.
- A config translator gives real interop (a Promptfoo user can run their config on us) at a tiny,
  pure-Python, well-tested cost, with no new runtime dependency.
- The PyPI `promptfoo` package is only a shim that runs `npx promptfoo@latest`, so it is not a usable
  Python library.

## Alternatives
- **Vendor or depend on Promptfoo** - rejected: Node runtime, remote-only plugins, a second engine.
- **The PyPI `promptfoo` wrapper** - rejected: it shells out to Node and reaches the network.
- **Silently approximate unsupported ids** - rejected: it would turn a not-supported test into a false
  pass or false negative; we error clearly instead.

## Trade-offs
- The translator covers a subset; remote-only and deprecated ids error. That is intentional and honest.
- A mapped strategy like `jailbreak` runs our `best_of_n`, not Promptfoo's algorithm; the docs say so.
- If Promptfoo makes a plugin local later, we can add it to the mapping.

## References
- [`../research/promptfoo-integration.md`](../research/promptfoo-integration.md) (source review)
- [`../integrations/promptfoo.md`](../integrations/promptfoo.md) (supported subset)
