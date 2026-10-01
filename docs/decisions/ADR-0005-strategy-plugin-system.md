# ADR-0005 - Strategy plugin system and adaptive loop

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Attacks are **Strategy plugins** behind one interface, discovered via entry points. A code-based
**Attack Planner** selects and adapts strategies; the **adaptive loop** runs them. Adding a strategy must
not require editing the core engine. The planner and loop are modelWrecker's core IP.

## Why
- modelWrecker's core rule: build the engine that supports hundreds of attacks, not hundreds of
  attacks hard-coded. A plugin interface + a planner is exactly that.
- Keeps selection logic out of prompts and out of the provider layer.
- Lets us wrap PyRIT/garak algorithms as strategies without the core knowing (ADR-0006).

## Alternatives
- **Giant if/elif of techniques** (or ~80 attacker tools) - flexible but the "engine" becomes the tool
  list; selection logic leaks into prompts; hard to test and extend. Rejected.
- **Fixed universal attack sequence** - can't adapt to the target; wastes budget. Rejected.

## Trade-offs
- A planner is more work than a static sequence and needs its own tests/telemetry (ASR by strategy). That
  investment is the product's differentiation.
