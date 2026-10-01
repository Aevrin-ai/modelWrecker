# ADR-0002 - License and no AGPL code reuse

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
License modelWrecker under **Apache-2.0**. **Do not copy or adapt AGPL-licensed red-team code** into the
codebase. Prior tooling may inform the design conceptually, but no copyleft source is reused.

## Why
- Apache-2.0 is permissive, patent-protective, and compatible with the Aevrin platform and with most of
  our dependencies (MIT/Apache/BSD).
- AGPL-3.0 code, if copied in, would force modelWrecker (and anything running it as a network service) to
  be AGPL - incompatible with a permissively-licensed Aevrin backend. Learning a pattern carries no
  license obligation; copying code does.

## Alternatives
- **MIT** - simpler but no patent grant; Apache-2.0 is preferred for a security product.
- **AGPL** (to allow lifting copyleft red-team code) - rejected: it would restrict Aevrin's deployment
  model.

## Trade-offs
- We re-implement anything we like from prior tooling rather than reuse it. Acceptable: most of what we
  value (role separation, reliability-first verification, judge calibration) is a pattern, not code, and
  the algorithms we want come from permissively-licensed libraries instead (ADR-0006).
