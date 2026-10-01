# ADR-0008 - Security model

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Build security in from the start as a dedicated layer (`security/`): auth-by-default on any network
surface + anti-CSRF; host-affecting tools off by default; a central SSRF egress guard; confined file
reads; secret/PII redaction before any write; atomic state writes; wall-clock deadlines + cancel paths;
sandboxed, no-execute-by-default handling of attack-generated code. Full rules in
[`../security/SECURITY.md`](../security/SECURITY.md); threats in
[`../security/THREAT-MODEL.md`](../security/THREAT-MODEL.md).

## Why
Aevrin's security research into local AI tooling is a catalogue of what goes wrong in tools very like this
one: an unauthenticated local service gives browser-CSRF remote code execution, SSRF plus credential
exfiltration, arbitrary file read, and unredacted secret logging; alongside reliability bugs (leaked
clients, torn state, wedged loops). In the wild these are usually bolted on after the fact. modelWrecker
builds the controls in from day one instead of shipping and patching.

## Alternatives
- **Ship fast, harden later** - rejected; it exposes users to critical remote-code-execution risk in the
  interim and is more expensive to fix afterward.
- **Security as per-call checks** - rejected; audits show per-call hygiene gets missed (for example, a
  file path confined on write but not on read). A central layer is enforceable.

## Trade-offs
- More upfront design and some friction (host tools require explicit opt-in). That friction is the
  feature: least privilege by default is what keeps the operator safe.
