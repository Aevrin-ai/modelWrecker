# ADR-0009 - First-party payload/transform engine

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Build a **small, first-party** payload transform set (encodings, unicode obfuscation, homoglyph,
zero-width, token splitting, delimiter/structural transforms) under our own license. Do **not** vendor or
drive the plinius corpora (P4RS3LT0NGV3 / L1B3RT4S / ENI) or their Node bridge. Transforms are plugins,
optional, and planner-driven.

## Why
- The transforms we need are small, well-understood string operations - cheap to own and test.
- The plinius corpora bring a Node runtime dependency, runtime git-clones, mixed/unclear licensing, and a
  maintenance liability; some naive tooling wraps them with a fails-closed checksum gate (the anti-pattern
  modelWrecker forbids - see ADR-0010).
- Owning the set keeps the dependency budget low and licensing clean (Apache-2.0 throughout).

## Alternatives
- **Vendor Parseltongue** - large transform catalog for free, but drags in Node, licensing ambiguity, and
  the checksum gate. Rejected.
- **No transforms at all** - some bypasses genuinely need encoding; a small set is worth it. Transforms
  stay optional so they're never in the way.

## Trade-offs
- Fewer exotic transforms than the 222-transform plinius engine. Acceptable: the planner decides when a
  transform helps, and the common ones cover most real bypasses. We can add transforms as plugins later.
