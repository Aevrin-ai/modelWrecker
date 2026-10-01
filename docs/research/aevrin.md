# Research: Aevrin

*Phase 0 note. Captured 2026-10-01 from aevrin.net, aevrin.net/product, docs.mcp.aevrin.net.*

## What Aevrin is

Aevrin positions itself as "the security layer for the AI-native software stack". It secures five
layers that AI touches, framed as a journey:

1. **Connect (MCP Security)** - *available today.* Scans MCP servers before you trust them, from a
   repo, a local path, or a live HTTP/SSE endpoint. A Claude Code hook blocks `claude mcp add` when
   a server has unresolved high/critical findings. Findings map to the **OWASP MCP Top 10**.
2. **Build** - reviews AI-generated code for vulnerabilities, secrets, and IaC misconfigurations.
3. **Deploy (pentest)** - tests running apps from the attacker's side (HTTP proxy, browser
   automation, recon) and **validates** findings instead of only flagging them.
4. **Use** - discovers which AI tools a team actually uses and where company data goes.
5. **Ship (agent-test)** - pre-deploy testing of agents: define expected behavior, generate
   synthetic scenarios, find instruction-following failures, unsafe tool use, permission mistakes;
   fix and re-test.

Separately, Aevrin advertises an **AI Red Teaming** product: "Prompt injection, jailbreaks,
sensitive data leakage, policy failures, and harmful outputs, found before launch and blocked in
production." Headline capabilities: 1000+ adversarial techniques, OWASP LLM Top 10 mapping, and a
runtime policy firewall. **This is the product modelWrecker is the engine for.**

## The parts of Aevrin's model worth copying

- **Findings are validated, not just reported.** The pentest product's whole pitch is "proof:
  reproduction steps attached, verified." modelWrecker's reliability + evidence system is the same
  idea applied to AI attacks. See [`../attack-engine/RELIABILITY.md`](../attack-engine/RELIABILITY.md).
- **A finding means the same thing everywhere.** The MCP scanner maps every result to the OWASP MCP
  Top 10 so a finding reads the same in the CLI, the Claude Code hook, and the dashboard. We adopt
  the same discipline: one taxonomy mapping, used in every output. See
  [`../architecture/TAXONOMY.md`](../architecture/TAXONOMY.md).
- **Honesty over false confidence.** Aevrin's docs are explicit that some things can't be tested
  statically (e.g. runtime prompt injection via a live tool) and they *say so* rather than silently
  omitting it. modelWrecker reports coverage and limits the same way, and never upgrades a one-shot
  success to a confident finding.
- **Spec-driven agent testing.** "Define what the agent must do and must never do, generate
  scenarios, test, fix, re-test." This maps directly onto our objective → campaign → re-run loop.
- **Multiple delivery surfaces from one engine.** CLI, a Claude Code hook, a dashboard - all over
  the same core. modelWrecker is a library + CLI first, so Aevrin surfaces can sit on top.

## How modelWrecker fits Aevrin

modelWrecker is designed to be the **reusable red-teaming backend** behind Aevrin's "AI Red Teaming"
and "agent-test" products. It must stay UI-agnostic and callable from the Aevrin CLI, dashboard,
CI/CD, Claude Code, and MCP. That is why the engine is a library with a thin CLI, every role sits
behind an interface, and there is no tight coupling to any UI. See
[`../decisions/ADR-0012-engine-library-first.md`](../decisions/ADR-0012-engine-library-first.md).

## Note on sources

Aevrin's public site is marketing + MCP-scanner docs; it does not publish the red-teaming engine's
internal architecture. So this is directional alignment, not a spec to copy. Where Aevrin is
concrete (MCP Top 10 mapping, validated findings, honesty about coverage) we follow it closely.