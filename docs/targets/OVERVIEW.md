# Target adapters

**Purpose.** Give the engine one way to talk to any system under test, while only exposing the operations
that system actually supports. A target is *what we attack*; it is not a provider (a provider
is just a model endpoint; a target may be a whole agent or app).

**Responsibilities.** Deliver attempts to the target and return observations, declaring capabilities so
the planner only runs compatible strategies.

**Inputs.** A target config + an attempt.
**Outputs.** An `Observation` (response, reasoning if exposed, tool calls, metadata).
**Dependencies.** providers (for model targets), MCP client, httpx; security (egress guard).
**Failure cases.** Calling an unsupported capability raises before any network call; the planner checks
capabilities first so this is a guard, not a runtime surprise.

## Capabilities (declare, don't assume)

```text
send_message        send_multiturn      upload_image
call_tool           observe_tool_call   reset_session
get_metadata
```

A target implements only the ones it truly supports and reports them via `capabilities()`. A pure chat
API supports `send_message`/`send_multiturn`; an agent adds `call_tool`/`observe_tool_call`; an MCP
target adds tool discovery. Full signatures: [`../interfaces/target.md`](../interfaces/target.md).

## Target types

```mermaid
flowchart TD
  TI[Target Interface] --> CHAT[Chat / completions API]
  TI --> AGENT[Tool-using agent]
  TI --> RAG[RAG system]
  TI --> MCPt[MCP-connected agent]
  TI --> HTTP[Generic HTTP API]
  TI --> LOCAL[Local model]
  TI --> BROWSER[Browser app - later]
```

Phase 4 ships the **chat/completions API** target (the baseline). After that the confirmed order is
**agent, then RAG, then MCP** targets, with the generic HTTP target alongside them (see
[`../../ROADMAP.md`](../../ROADMAP.md)). This order is a resolved decision in
[`../../DECISIONS.md`](../../DECISIONS.md).

## Untrusted by default

A target's responses, reasoning, and tool outputs are **untrusted input** - they can carry injected
instructions aimed at the engine or the judge. Nothing from a target is ever executed or followed as an
instruction. All outbound requests a target makes on our behalf pass the egress guard. See
[`../security/SECURITY.md`](../security/SECURITY.md).

## Metadata and reset

`get_metadata` captures model/version/config for evidence; `reset_session` gives multi-turn strategies a
clean slate so attempts don't contaminate each other.
