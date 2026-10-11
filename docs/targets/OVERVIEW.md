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
call_tool           observe_tool_call   tool_environment
ingest_document     reset_session       get_metadata
```

A target implements only the ones it truly supports and reports them via `capabilities()`. A pure chat
API supports `send_message`/`send_multiturn`; an agent and an MCP target add `call_tool`,
`observe_tool_call`, and `tool_environment` (a bounded multi-step tool session where read tools return
fixtures and no tool is executed - see below); a RAG target adds `ingest_document`. A strategy that needs
a capability the target lacks is reported as NOT TESTED with the reason, never silently skipped. Full
signatures: [`../interfaces/target.md`](../interfaces/target.md).

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

Phase 4 ships the **chat/completions API** target (the baseline). **Phase 9 adds the agent, RAG, and MCP
targets** (the confirmed order, a resolved decision in [`../../DECISIONS.md`](../../DECISIONS.md)); the
generic HTTP and browser targets remain later work (see [`../../ROADMAP.md`](../../ROADMAP.md)).

`config.target.type` selects the target (`chat` default, `agent`, `rag`, `mcp`, `memory`, `multi_agent`) and `target_options`
carries its type-specific config. A factory (`targets/factory.py`) builds the right one, so the loop never
changes. What each adds:

- **agent** (`targets/agent.py`): a tool-using agent. `target_options.tools` is a list of
  `{name, description, sensitive}`. The agent decides tool calls; modelWrecker only *observes and records*
  them (it never executes a tool), and marks any sensitive call for the judge. Attack: `tool_misuse`
  (excessive agency / goal hijack; OWASP LLM03, ASI01). The agent and MCP targets also run a **simulated
  tool environment** (`run_scenario`): a bounded loop where the harness supplies tool results (fixtures),
  so an instruction hidden in tool output can be tested. This powers `indirect_prompt_injection`, which
  plants a canary in the fixture and checks whether the agent leaks it or calls a sensitive tool
  (OWASP LLM01/LLM02). Nothing is ever executed and the loop stops after a fixed number of steps.
- **rag** (`targets/rag.py`): a retrieval-augmented system. `target_options.documents` is the corpus; it
  retrieves by keyword overlap and injects documents as untrusted context. If `allow_ingest` (default on)
  it declares INGEST_DOCUMENT. Attack: `rag_injection` plants a poisoned document and triggers its
  retrieval (indirect prompt injection; OWASP LLM01/LLM05).
- **mcp** (`targets/mcp_target.py`): an MCP-connected agent whose tools (inline for now) may carry poisoned
  descriptions. Attack: `mcp_tool_poisoning` (OWASP MCP03). Tools can be inline, or discovered from a
  live MCP server with `target_options.mcp_url` (streamable HTTP): modelWrecker lists the server's
  tools and uses their descriptions as the untrusted catalog, and never calls a tool on the server
  (discovery only). A tool whose name or description implies a state change is marked sensitive (or
  name them in `target_options.sensitive_tools`).
- **memory** (`targets/memory.py`): an agent that keeps notes across sessions (notes survive
  `reset_session`). Attack: `memory_poisoning` plants a note in one session and checks a later one
  (OWASP LLM01/LLM02; group G5).
- **multi_agent** (`targets/multi_agent.py`): a researcher agent whose notes a main assistant trusts.
  Attack: `multi_agent_injection` hides an instruction in the researcher's source (group G7).
- **chat with `vision: true`**: declares UPLOAD_IMAGE so `multimodal_injection` can send an image whose
  text carries an instruction. Text-only models leave it off, so the strategy is reported NOT TESTED.

## Untrusted by default

A target's responses, reasoning, and tool outputs are **untrusted input** - they can carry injected
instructions aimed at the engine or the judge. Nothing from a target is ever executed or followed as an
instruction. All outbound requests a target makes on our behalf pass the egress guard. See
[`../security/SECURITY.md`](../security/SECURITY.md).

## Metadata and reset

`get_metadata` captures model/version/config for evidence; `reset_session` gives multi-turn strategies a
clean slate so attempts don't contaminate each other.
