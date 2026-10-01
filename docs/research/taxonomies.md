# Research: security taxonomies

*Phase 0 note. Captured 2026-10-01 from OWASP GenAI Security Project, OWASP MCP Top 10, and MITRE
ATLAS. Our rule is explicit: **do not invent mappings.** Only map a finding to an entry that exists
in the official source, and pull exact titles/IDs from the official document at implementation time.*

modelWrecker maps every finding to one or more of these taxonomies so a finding reads the same
everywhere (the Aevrin discipline). The mapping tables that the engine actually ships live in
[`../architecture/TAXONOMY.md`](../architecture/TAXONOMY.md); this note records the authoritative
sources and the exact IDs we verified.

## OWASP Top 10 for LLM Applications

There are now two relevant editions. The **2026** edition is current (published Aug 4 2026); the
**2025** edition is still widely cited. Verified from the canonical source repo
`GenAI-Security-Project/GenAI-LLM-Top10` (`2026/final`):

**2026 edition (current):**

- LLM01 - Prompt Injection
- LLM02 - Sensitive Information Disclosure
- LLM03 - Excessive Agency
- LLM04 - Supply Chain
- LLM05 - Data and Model Poisoning
- LLM06 - Unbounded Consumption
- LLM07 - Misinformation
- LLM08 - Hidden Context Exposure *(new in 2026)*
- LLM09 - Vector and Embedding Weaknesses
- LLM10 - Improper Output Handling

**2025 edition (for back-compat with existing reports):** same set, different ordering -
LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and
Model Poisoning, LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage,
LLM08 Vector and Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption.

> Implementation note: the engine stores the **edition** alongside the ID (e.g. `LLM01:2026`) so a
> finding is never ambiguous between editions.

## OWASP Top 10 for Agentic Applications (2026)

Published Dec 2025 by the OWASP GenAI Security Project; IDs are **ASI01-ASI10**. Confirmed IDs and
the two endpoints of the list: **ASI01 - Agent Goal Hijack** (external content redirects the agent's
goal) and **ASI10 - Rogue Agents** (misalignment in deployment: reward hacking, specification gaming,
autonomy drift). The middle entries (ASI02-ASI09) cover tool misuse, identity/privilege abuse,
guardrail/sandbox gaps, information disclosure, data poisoning, resource exhaustion, supply chain,
and human-trust exploitation.

> **Open item:** secondary write-ups disagree on the exact ASI02-ASI09 titles. Before any ASI mapping
> ships, pull the exact titles from the official PDF at
> `genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/`. Tracked in
> [`../../ROADMAP.md`](../../ROADMAP.md) → Known problems.

## OWASP MCP Top 10 (2025)

From `owasp.org/www-project-mcp-top-10`. Next release expected Oct 2026 - re-check.

- MCP01 - Token Mismanagement & Secret Exposure
- MCP02 - Privilege Escalation via Scope Creep
- MCP03 - Tool Poisoning (incl. rug pulls, schema poisoning, tool shadowing)
- MCP04 - Software Supply Chain Attacks & Dependency Tampering
- MCP05 - Command Injection & Execution
- MCP06 - Intent Flow Subversion / Prompt Injection via Contextual Payloads
- MCP07 - Insufficient Authentication & Authorization
- MCP08 - Lack of Audit and Telemetry
- MCP09 - Shadow MCP Servers
- MCP10 - Context Injection & Over-Sharing

## MITRE ATLAS (techniques we map to)

Verified technique IDs relevant to LLM attacks:

- AML.T0051 - LLM Prompt Injection
- AML.T0054 - LLM Jailbreak
- AML.T0057 - LLM Data Leakage
- AML.T0048 - External Harms
- AML.T0043 - Craft Adversarial Data
- AML.T0024 - Exfiltration via ML Inference API

> For techniques not in this verified set, look up the exact ATLAS ID before mapping. Never guess an
> `AML.Txxxx` number.

## How mapping works in the engine

- A **strategy** declares the taxonomy entries its *attack type* can produce (candidate mappings).
- A **finding** carries the entries that actually applied, chosen from the strategy's candidates and
  the judge's verdict - never auto-expanded beyond the official lists.
- Every mapping stores `{framework, id, edition, title}` so output is unambiguous and re-verifiable.
