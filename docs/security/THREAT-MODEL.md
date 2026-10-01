# Threat model

**Purpose.** Name the threats modelWrecker faces so the controls in [`SECURITY.md`](SECURITY.md) exist
for a reason, not by habit. Written in simple terms.

**Method.** We look at each actor and asset, list what could go wrong, and point to the control. This is
grounded in Aevrin's security research into very similar AI tooling, plus the standard LLM/
agent threat set.

## Assets

- The operator's machine and network (the engine runs autonomous loops on it).
- Provider API keys and other secrets.
- Evidence/run artifacts (can contain harmful content and leaked secrets).
- The integrity of findings (a false finding wastes trust; a missed one is a gap).

## Actors

- **Operator** - trusted, authorized.
- **The target** - untrusted. Its responses/reasoning/tool outputs can carry injected instructions.
- **Datasets/corpora** - untrusted content fetched or loaded.
- **A malicious web page** the operator visits while a tool is running (a known CSRF vector against local AI tools).
- **A supply-chain attacker** (the LiteLLM Mar-2026 incident: a poisoned provider library).

## Threats → controls

```mermaid
flowchart TD
  T1[Browser-driven RCE via unauth surface] --> C1[Library+CLI first; auth+anti-CSRF on any API; host tools off]
  T2[SSRF / metadata theft] --> C2[Egress guard, re-check on redirect]
  T3[Secret exfiltration via logs or read_file] --> C3[Redaction; confined reads; 0600 artifacts]
  T4[Prompt injection from target/dataset into engine or judge] --> C4[Treat all as data; never execute; multi-signal judge]
  T5[Autonomous loop wedges / runs away] --> C5[Deadlines, cancel path, stuck detection, budgets]
  T6[Supply-chain poisoning of a provider lib] --> C6[Thin swappable providers; gateways optional; lockfile; no .pth-style trust]
  T7[False findings from a weak judge] --> C7[Calibration + multi-signal + reliability replay]
  T8[Attack-generated code harms host] --> C8[Sandbox; no-execute default]
  T9[Lost/torn state] --> C9[Atomic writes; no silent reset]
```

| # | Threat | Control | Source |
|---|--------|---------|--------|
| T1 | Unauthenticated surface → browser-CSRF RCE | library+CLI first; auth + anti-CSRF; host tools off by default; refuse non-loopback bind without auth | Aevrin security research |
| T2 | SSRF to internal/metadata endpoints | central egress guard, redirect re-check | Aevrin security research |
| T3 | Secret/PII exfiltration via logs or arbitrary file read | redaction before write; confined reads; restrictive perms | Aevrin security research |
| T4 | Indirect prompt injection from target or dataset | untrusted-by-default; never follow target output as instruction; multi-signal judge resists framing | OWASP LLM01; MCP06/10 |
| T5 | Runaway/wedged autonomous loop | wall-clock deadlines, cancel/force-stop, stuck detection, budgets | Aevrin security research |
| T6 | Poisoned provider dependency | thin provider layer, optional gateways, pinned lockfile, Docker-pinned if a gateway is used | LiteLLM incident |
| T7 | False findings | judge calibration + ensemble + reliability replay | Aevrin "validated"; reliability-first practice |
| T8 | Attack code damaging the host | sandbox with isolation + limits; no-execute default | general |
| T9 | Lost settings / torn state | atomic writes, lock/merge, no silent `{}` reset | Aevrin security research |

## Explicitly out of scope (for now, stated honestly)

- Hardening the *targets* we test (that's the customer's job; we report).
- Defending against a malicious *operator* (the operator is trusted; we record asserted authorization).
- A fully multi-tenant hosted service (the engine is self-hosted; a hosted Aevrin layer would add its own
  tenant isolation threat model later).

Honesty over false confidence (the Aevrin principle): where a threat is only partly mitigated, the
relevant doc and run output say so rather than implying full coverage.
