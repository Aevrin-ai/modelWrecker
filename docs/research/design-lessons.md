# Research: design lessons

*Phase 0 note. These are the design patterns modelWrecker adopts and the failure modes it avoids, drawn
from Aevrin's security research into AI red-team tooling and from standard LLM/agent security practice.*

modelWrecker is the red-team engine of the Aevrin platform. Its design follows Aevrin's security
principles: validated findings, honesty about coverage, least privilege, and a clean separation of
roles. This note records the patterns we keep and the mistakes we design out, so the architecture docs
can link to one place for "why".

## Patterns modelWrecker keeps

- **Attacker / target / judge are separate roles**, chosen independently in config. This gives unbiased,
  explainable evidence and lets each role use the best or cheapest model. See
  [`../decisions/ADR-0004-attacker-target-judge-split.md`](../decisions/ADR-0004-attacker-target-judge-split.md).
- **A tool-calling attack loop** with explicit stop conditions and a stuck detector, so an autonomous run
  ends cleanly instead of spinning. See [`../attack-engine/OVERVIEW.md`](../attack-engine/OVERVIEW.md).
- **One common interface per attack**, so techniques plug in without touching the core. See
  [`../attack-engine/STRATEGIES.md`](../attack-engine/STRATEGIES.md).
- **Reliability-first verification**: replay a success N times and measure the real rate before calling
  it a finding; a one-shot success is never trusted. See
  [`../attack-engine/RELIABILITY.md`](../attack-engine/RELIABILITY.md).
- **Judge calibration on benign fixtures** before any success rate is trusted, so a weak judge cannot
  manufacture findings. See [`../judges/OVERVIEW.md`](../judges/OVERVIEW.md).
- **Structured run logs, repro packs, and a CI gate**, so every finding is reproducible and can fail a
  build. See [`../architecture/EVIDENCE-AND-FINDINGS.md`](../architecture/EVIDENCE-AND-FINDINGS.md).
- **Backend pinning for reproducibility**, so replays do not drift across load-balanced backends.

## Patterns modelWrecker redesigns

- **Attacks are engine strategies, not raw attacker tools.** Exposing dozens of attack tools directly to
  an attacker model is flexible but puts selection logic inside prompts and makes "the engine" just a
  tool list. modelWrecker puts selection in a code-based Attack Planner and uses an attacker model
  *inside* strategies that need reasoning. See
  [`../attack-engine/ATTACK-PLANNER.md`](../attack-engine/ATTACK-PLANNER.md).
- **Provider lifecycle is owned centrally.** Building a provider ad hoc at every call site leaks pooled
  HTTP clients. modelWrecker builds and closes providers once per run boundary and hands them to
  strategies via context. See [`../providers/OVERVIEW.md`](../providers/OVERVIEW.md).
- **No reinvented provider wire code.** A thin interface sits over official SDKs and an optional
  multiplexer, instead of hand-writing every protocol. See
  [`../decisions/ADR-0003-provider-abstraction.md`](../decisions/ADR-0003-provider-abstraction.md).

## Failure modes modelWrecker designs out

Aevrin's audits of local AI tooling turn up the same dangerous mistakes repeatedly. modelWrecker builds
in the control for each from day one rather than retrofitting it. The full mapping is in
[`../security/THREAT-MODEL.md`](../security/THREAT-MODEL.md); the headline ones:

| Failure mode (seen in local AI tooling) | modelWrecker's built-in control |
|-----------------------------------------|---------------------------------|
| Unauthenticated local service → browser-CSRF remote code execution | Library + CLI first; any API needs auth + anti-CSRF by default; CORS is never treated as access control. |
| Host tools (shell, file write, arbitrary HTTP) reachable with no auth | Host-affecting tools off by default; never in a network-reachable toolset without explicit opt-in. |
| SSRF + credential exfiltration via outbound requests | One central egress guard blocks loopback/link-local/RFC1918/metadata and re-checks on redirect. |
| Arbitrary file read (no path confinement) | All reads confined to a working directory; symlink escapes rejected. |
| Secrets and auth headers written to logs in the clear | Redact keys/headers/passwords/PII before any write; artifacts `0600`/`0700`. |
| Pooled HTTP clients leaked across many call sites | Provider lifecycle owned centrally, closed once per boundary. |
| Non-atomic state writes, lost-update races, silent reset on a torn read | Atomic writes (`tmp`+`os.replace`); lock/merge; never reset to `{}` silently. |
| Autonomous loop with no timeout that can wedge forever | Every run and model call has a wall-clock deadline, a cancel path, and stuck detection. |
| Untested success paths that crash on first real success | Test the happy path, not only the error path. |
| Broad `except: pass` that hides startup/config failure | Narrow exception handling; never boot half-initialized silently. |

The lesson behind the lessons: an AI red-team tool is itself a high-value target. Aevrin's stance is to
build the controls in from the start, which is exactly what modelWrecker does.
