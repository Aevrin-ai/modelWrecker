# ADR-0010 - No mandatory checksum / corpus-integrity gate

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Do **not** build a custom checksum / hash-gate / corpus-integrity subsystem, and do **not** make SHA
verification a prerequisite for the normal attack pipeline. Dependency integrity is handled by normal
lockfiles (`uv.lock`). The attack engine works directly with strategies, payloads, providers, targets,
judges, datasets, and plugins without a checksum step.

## Why
- modelWrecker forbids a "missing checksum → attack blocked" design unless a documented threat
  genuinely requires it.
- A common anti-pattern does exactly this: a corpus lock file pins runtime-fetched corpora and
  "fails closed" (refuses to load) on `UNRESOLVED` - which blocks the pipeline on bookkeeping, not on a
  real security need.
- Our threat model (`../security/THREAT-MODEL.md`) handles supply chain with pinned lockfiles and
  (if a gateway is used) a pinned container - standard, sufficient mechanisms.

## Alternatives
- **Custom checksum manifests** - rejected: ceremony, maintenance, and pipeline blocking for little gain
  over a lockfile.

## Trade-offs
- We rely on package-manager integrity rather than a bespoke gate. If a *specific, documented* threat ever
  requires artifact verification (e.g. signing externally-distributed evidence), we add it narrowly, for
  that artifact only, via a new ADR - never as a blanket prerequisite.
