# ADR-0006 - Reuse PyRIT and garak behind adapters

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Reuse **PyRIT** (MIT) for attack algorithms (PAIR, TAP, Crescendo, skeleton-key, many-shot, ...) and
**garak** (Apache-2.0) for batch probe/detector scanning, each **behind a Strategy adapter**. Do not
re-implement these algorithms.

Integration depth is a **hybrid**: use **thin adapters** to drive PyRIT orchestrators from our planner,
**and reuse PyRIT's memory and scoring** rather than duplicating them. PyRIT memory backs the attempt
history/conversation store for PyRIT-driven strategies, and PyRIT scorers run as judge signals inside our
judge ensemble. Our planner, reliability, evidence, and finding engine remain the surrounding product,
and modelWrecker never surfaces PyRIT/garak's own reporting as its output.

## Why
- Both are mature, permissively licensed, actively released (PyRIT 1.1.0 Sep 2026; garak 0.17.0 Sep 2026),
  and free/self-hostable. Our rule is to not rebuild mature OSS.
- The algorithms are well-studied and fiddly; wrapping is cheaper and more correct than rewriting.
- Reusing PyRIT memory and scoring avoids maintaining a second conversation store and a second scorer set,
  and keeps PyRIT-driven strategies behaving the way PyRIT expects internally.

## How the reuse is bounded
- PyRIT memory is an **implementation detail of PyRIT-backed strategies**, adapted into our `Attempt`/
  `Observation` shapes at the boundary; the rest of the engine never reads PyRIT memory directly.
- PyRIT scorers are wrapped as `JudgeSignal` plugins, so the verdict combiner treats them like any other
  signal and can out-vote them. See [`../judges/OVERVIEW.md`](../judges/OVERVIEW.md).
- A finding's reliability and evidence are always produced by **our** systems, so results are uniform
  across first-party and PyRIT-backed strategies.

## Alternatives
- **Thin adapter only, no memory/scoring reuse** - cleaner boundary but duplicates a conversation store and
  scorers; rejected in favor of the hybrid.
- **Depend on PyRIT as the engine** - rejected; it would couple our core and its reporting to us.
- **Implement everything first-party** - full control but large and duplicates maintained work. We keep
  first-party only for strategies specific to our loop (prefill, best-of-N, RAG/MCP/tool/memory).

## Trade-offs
- Reusing PyRIT memory/scoring couples us more tightly to PyRIT internals than a pure thin adapter would.
  Mitigated by confining that coupling to the PyRIT adapter module and the scorer wrappers; if PyRIT churns
  badly, those two seams absorb it, and the interfaces the rest of the engine sees do not change. garak
  stays phase-gated to Phase 8.
