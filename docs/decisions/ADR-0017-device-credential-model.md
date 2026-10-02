# ADR-0017 - Device credential model

- **Status:** Accepted
- **Date:** 2026-10-02

## Decision
Each local install registers once as a **device** and receives a **scoped device or project token**. The
engine uses this token to sync results and read its current entitlement, and nothing more. The user's
Google access or refresh token is never placed in Docker, the CLI, the MCP server, or the engine. The
device token is stored with `0600` permissions and can be revoked per device. Full model:
[`../security/authentication.md`](../security/authentication.md).

## Why
- The Google token is a powerful, account-level credential. Keeping it out of the compute plane means a
  compromised device cannot sign in as the user or reach billing.
- A scoped, per-device, revocable token limits blast radius: a leaked device token is time-limited and can
  be revoked without signing the user out everywhere.
- It keeps user sign-in (OAuth and OIDC at the dashboard) separate from device auth, so the two can fail
  independently. See [`ADR-0014`](ADR-0014-local-cloud-boundary.md).

## Alternatives
- **Reuse the Google token on the device** - rejected. It would ship a high-value credential into the
  container and couple device auth to the user's identity provider session.
- **A single shared account key for all devices** - rejected. It cannot be revoked per device and leaks
  widely if one device is compromised.

## Trade-offs
- Adds a registration step and a token lifecycle (issue, store, refresh, revoke). That lifecycle is the
  point; it is what keeps the credential scoped and revocable.
