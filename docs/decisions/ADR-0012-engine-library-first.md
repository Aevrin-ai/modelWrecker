# ADR-0012 - Engine is a library + CLI first; any API/UI is separate

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Ship modelWrecker as a **library with a thin CLI** first. There is **no network surface** in the core. Any
API or dashboard is a **separate, later layer** that must be authenticated and anti-CSRF from day one and
must refuse non-loopback binds without auth. The engine stays UI-agnostic so Aevrin surfaces (CLI,
dashboard, CI, Claude Code, MCP) can sit on top.

## Why
- The single worst class of findings in Aevrin's audits of AI tooling comes from an **unauthenticated dashboard**
  bolted onto the engine (browser-CSRF RCE, credential exfiltration). Keeping the engine free of a network
  surface removes that entire attack class from the core.
- modelWrecker is designed to be a reusable backend for the Aevrin platform, not coupled to a UI
 . A library+CLI is the most reusable shape.

## Alternatives
- **Build the dashboard alongside the engine now** - this is what naive tooling does and it creates the
  critical findings. Rejected.
- **No CLI, library only** - less usable for operators and CI. The thin CLI is worth it.

## Trade-offs
- No GUI out of the box in early phases. Acceptable: the CLI covers operators and CI, and an authenticated
  API/dashboard is a deliberate later phase (Phase 10) built on the security model (ADR-0008).
