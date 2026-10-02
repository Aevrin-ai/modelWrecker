# ADR-0018 - Entitlement enforcement

- **Status:** Accepted
- **Date:** 2026-10-02

## Decision
The cloud issues a **signed, scoped entitlement** that states what a user's plan allows. The local engine
**verifies the signature** and enforces the limits locally, before each guarded operation. The attack
engine asks only "can this operation run?" and acts on allowed or denied; it holds no pricing or plan
logic. Enforcement happens in three places: the UI hides disallowed actions for convenience, the backend
enforces on every request, and the local engine enforces via the signed entitlement. The UI alone is never
treated as enforcement. Full model: [`../security/entitlements.md`](../security/entitlements.md).

## Why
- The engine must not depend on a live cloud answer for every attack, or it would create a hidden cloud
  dependency and break offline use. A signed entitlement lets the cloud sign once and the engine enforce
  many times, including offline. This follows [`ADR-0014`](ADR-0014-local-cloud-boundary.md).
- Signing prevents an easy client-side bypass: editing a local file does not grant more, because an
  unsigned or expired entitlement is rejected.
- Keeping plan logic out of the attack code stops subscription checks from being scattered through the
  engine, which is a maintenance and security risk.

## Alternatives
- **Check the cloud per attack** - rejected. It breaks offline use and makes the cloud a compute
  dependency.
- **Unsigned local config for limits** - rejected. It is trivially edited, giving a free client-side
  bypass.
- **Enforce only in the backend and UI** - rejected. The compute plane runs locally, so the engine itself
  must enforce, or local runs are unbounded.

## Trade-offs
- Needs a signing key (a cloud secret, never shipped to the engine), a verification path in the engine, and
  an expiry and refresh cycle. Denied-by-default when verification fails. These are the safeguards, not
  overhead to trim.
