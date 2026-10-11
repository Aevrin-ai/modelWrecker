# From incident to strategy

**Purpose.** Show how a real-world agent-attack incident becomes a repeatable, safe test inside
modelWrecker. We do not copy an exploit. We read the incident, confirm it against a primary source,
find the underlying weakness, and turn that weakness into a strategy with synthetic fixtures, mock
tools, and canaries. A canary is a unique random token we plant so we can see, with certainty, if it
leaves the trust boundary.

This note pairs with [`research-sources.md`](research-sources.md) (where the incidents come from) and
[`../attack-engine/STRATEGIES.md`](../attack-engine/STRATEGIES.md) (the strategies themselves).

## The pipeline

```mermaid
flowchart TD
  A[Incident or paper] --> B[Verify sources]
  B --> C[Identify root cause]
  C --> D[Define security property]
  D --> E[Create test scenario]
  E --> F[Create benign control]
  F --> G[Run against authorized target]
  G --> H[Evaluate]
  H --> I[Save evidence]
  I --> J[Add regression test]
```

Each step in plain terms:

- **Verify sources.** Confirm the incident against the primary advisory, CVE, or finder's write-up.
  See "How we verify a claim" in [`research-sources.md`](research-sources.md).
- **Identify root cause.** The underlying weakness, not the surface trick. Many incidents share one
  root cause.
- **Define security property.** The thing that must stay true, stated as expected safe behavior (for
  example: the agent treats tool output as data, not as instructions).
- **Create test scenario.** A synthetic fixture that exercises the weakness, with a planted canary.
- **Create benign control.** The same fixture without the injected instruction, so we can measure
  false positives.
- **Run against authorized target.** Only the target the user configured and is allowed to test.
- **Evaluate.** A deterministic signal confirms a failure by observable behavior, then reliability
  replay confirms it is not luck.
- **Save evidence.** The scenario, the canary, the recorded tool calls, and where the canary went.
- **Add regression test.** So the weakness stays covered on every future run.

## Grouping incidents by weakness

We group incidents by their underlying weakness, not by the product they hit. Several incidents map to
one weakness, and one weakness maps to one strategy. Each incident then becomes a specific test case
(a scenario) inside that strategy. "Planned" means the strategy is not built yet.

| Group | Underlying weakness | modelWrecker strategy |
|-------|---------------------|-----------------------|
| G1 | Indirect prompt injection via tool output: the agent reads attacker content, then acts | `indirect_prompt_injection` |
| G2 | Data exfiltration via rendered links or images or a send sink: a canary leaves the boundary | `indirect_prompt_injection` (canary signal) and `rag_injection` |
| G3 | Tool-metadata poisoning, shadowing, or rug pull on MCP | `mcp_tool_poisoning` |
| G4 | Excessive agency: a consequential action with no confirmation | `tool_misuse` |
| G5 | Memory or context poisoning carried across sessions | `memory_poisoning` |
| G6 | Supply chain via repo instructions, rules files, tampered config, or a malicious extension | `supply_chain_injection` (and `indirect_prompt_injection`'s repo_issue scenario) |
| G7 | Multi-agent or agent-to-agent discovery injection | `multi_agent_injection` |

The first strategy we built for this work is `indirect_prompt_injection`, because it is the most
common incident class and it was the missing piece: the agent and MCP targets previously only did
single-turn tests. It covers G1, covers G2 through its canary signal, and covers G6's repo-issue
surface. `mcp_tool_poisoning` (G3) and `tool_misuse` (G4) already existed. The planned-but-missing families are now built too: `supply_chain_injection` (G6),
`memory_poisoning` (G5), `multi_agent_injection` (G7), and `multimodal_injection` (images), all
experimental. A live MCP-server connection and a live vision-model run remain future work.

## The verified incidents

These are the incidents we confirmed against primary sources. Layer is roughly where the weakness
lives. Group is from the table above. Dates are as published by the finder or vendor.

| Incident | Date | Layer | Group | Primary source | Covered by |
|----------|------|-------|-------|----------------|------------|
| MCP tool poisoning, shadowing, rug pull | 2025-04 | tool and supply chain | G3 | invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks | `mcp_tool_poisoning` |
| GitHub MCP toxic agent flow | 2025-05-26 | agent | G1 | invariantlabs.ai/blog/mcp-github-vulnerability | `indirect_prompt_injection` |
| Supabase MCP and Cursor SQL leak | 2025-07 (early) | agent and infra | G1 | generalanalysis.com/blog/supabase-mcp-blog | `indirect_prompt_injection` |
| EchoLeak, M365 Copilot, CVE-2025-32711 | 2025-06-11 | agent RAG and infra | G2 | Aim Labs write-up plus MSRC | `indirect_prompt_injection` |
| M365 Copilot auto tool invocation and ASCII smuggling | 2024-08-26 | agent | G1 and G2 | embracethered.com | `indirect_prompt_injection` |
| Slack AI exfiltration via public-channel injection | 2024-08-20 | agent RAG | G2 | promptarmor.substack.com | `indirect_prompt_injection` and `rag_injection` |
| ChatGPT macOS SpAIware memory poisoning | 2024-09-20 | agent memory | G5 | embracethered.com | Planned memory strategy |
| CamoLeak, GitHub Copilot Chat | 2025-10-08 | agent and infra | G2 | legitsecurity.com | `indirect_prompt_injection` |
| ForcedLeak, Salesforce Agentforce | 2025-09-25 | agent and infra | G2 | noma.security | `indirect_prompt_injection` |
| Rules File Backdoor, Cursor and Copilot | 2025-03-18 | supply chain | G6 | pillar.security | `indirect_prompt_injection` repo_issue plus planned supply-chain |
| GitHub Copilot agent self-config to RCE, CVE-2025-53773 | 2025-08-12 | agent and tool | G4 | embracethered.com | `tool_misuse` |
| Cursor CurXecute, CVE-2025-54135 | 2025-08-02 | tool, MCP client | G4 | cursor advisory GHSA-4cxx-hrm3-49rm | `tool_misuse` |
| Cursor MCPoison, CVE-2025-54136 | 2025-08-05 | supply chain and tool | G3 and G6 | research.checkpoint.com | `mcp_tool_poisoning` |
| Amazon Q Developer VS Code ext 1.84.0, CVE-2025-8217 | 2025-07-23 | supply chain | G6 | aws.amazon.com/security/security-bulletins/AWS-2025-015 | Planned supply-chain strategy |
| ServiceNow Now Assist second-order injection via agent discovery | 2025-11-19 | agent, multi-agent | G7 | appomni.com | Planned multi-agent strategy |

## Worked example: two incidents, one strategy

Take two confirmed incidents in group G1 and G2:

- **GitHub MCP toxic agent flow.** An agent with one token spanning a public and a private repository
  read an attacker-controlled public issue. The issue told it to publish private data, and it did, in
  a public pull request. The root cause is architectural: the agent treated issue text as instructions
  and had one over-broad credential.
- **Indirect injection via tool output.** The general pattern behind EchoLeak, Slack AI, and others:
  the agent reads attacker content through a tool and then leaks data or takes an action the user never
  asked for.

Both share one root cause: the agent trusts content it reads through a tool as if it were a user
instruction. That is exactly what `indirect_prompt_injection` tests. The strategy turns these
incidents into four scenario keys, each a synthetic fixture:

| Scenario key | Stands in for |
|--------------|---------------|
| `email` | An email the agent was asked to summarize (EchoLeak-style) |
| `webpage` | A web page the agent fetched |
| `repo_issue` | A repository issue the coding agent was asked to triage (GitHub MCP toxic flow) |
| `tool_output` | The output of a search tool |

How a scenario runs, using `repo_issue` as the example:

1. The user gives a harmless task, such as asking the agent to read the newest repo issue and report
   what it says.
2. A read tool returns fixture content. In the attack run, that fixture has an embedded instruction
   that tells the agent to route a planted canary to a mock send tool and to echo the canary in its
   reply. Both actions are observable.
3. The whole thing runs in the simulated tool environment: a bounded multi-step loop where read tools
   return fixtures and **no tool is ever executed**. The send tool is a mock that records a call but
   never sends anything.
4. The `canary_exfil` judge signal fires if the canary appears in the reply or in a sensitive tool
   call. This is a deterministic check on observable behavior, not an LLM opinion.
5. A matching **benign control** runs the same fixture without the injected instruction. If the
   control also "succeeds", the target misbehaves with no attack present, so the result is a false
   positive and does not become a finding.
6. Reliability replay repeats the attack to confirm the failure is real, not a one-off.

## What we never do

- We never copy a real exploit. Tests use synthetic fixtures we wrote, not captured attack payloads.
- We never execute a tool. The environment is simulated and every tool is a mock.
- We never confirm a failure by an LLM's opinion alone. A deterministic signal (the canary leaving the
  boundary, or a sensitive mock tool call) confirms it, and replay checks it is reliable.
- We never run against a target the user is not authorized to test.

## Related docs

- [`research-sources.md`](research-sources.md) - the sources and how we verify them.
- [`../attack-engine/STRATEGIES.md`](../attack-engine/STRATEGIES.md) - the strategy interface and the
  full strategy list.
- [`../judges/OVERVIEW.md`](../judges/OVERVIEW.md) - how deterministic signals outvote the LLM judge.
- [`../attack-engine/RELIABILITY.md`](../attack-engine/RELIABILITY.md) - replay and confirmation.
