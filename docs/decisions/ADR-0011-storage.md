# ADR-0011 - Storage: append-only JSONL + SQLite index

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Persist each run as an **append-only JSONL** event stream (the evidence source of truth) plus a **SQLite**
index for queries (findings by taxonomy, ASR by strategy, etc.). All writes are **atomic** (`tmp` +
`os.replace`); the index is rebuildable from the JSONL. Artifacts are written `0600`/`0700` and gitignored.

## Why
- Append-only JSONL is simple, durable, human-inspectable, and perfect for an immutable evidence log.
- SQLite gives real queries/metrics with zero server and no extra service - stays self-hostable.
- Atomic writes + a rebuildable index directly answer the torn-read, lost-update, and unbounded-file
  failures common in naive tooling, without needing a database server.

## Alternatives
- **Postgres/other server DB** - overkill for a self-hosted CLI tool; adds an operational dependency.
  Rejected for the core (a hosted Aevrin layer could add one later behind the storage interface).
- **Plain JSON file rewritten each time** (a single rewritten JSON state file, as naive tooling does) - caused the torn-read
  and lost-update bugs. Rejected.

## Trade-offs
- SQLite has limited concurrent-writer support; mitigated by funneling writes through one storage owner per
  run and keeping the JSONL as the source of truth. The storage layer is behind an interface, so a hosted
  deployment can swap the backend without touching the engine.
