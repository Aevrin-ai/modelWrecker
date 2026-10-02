# ADR-0013 - Harness integration (drive modelWrecker from Claude Code / Codex / other agents)

- **Status:** Accepted
- **Date:** 2026-10-01

## Decision
Ship a **harness integration** so an external agentic coding harness - Claude Code, Codex, or any MCP
client - can tell modelWrecker to attack a model and get the results back. It has two shapes:

1. **An MCP server** (`modelwrecker mcp`) exposing a small set of **safe** red-team orchestration tools
   (list strategies, define a target, run an objective, run a campaign, fetch findings, render a report,
   replay a finding). The harness drives these tools and summarizes the results to its user.
2. **A JSON driver mode** (`modelwrecker run ... --output json`) for harnesses that are not MCP clients
   (shell out, read structured output).

The MCP server exposes **only** orchestration tools. It never exposes shell, file-write, or arbitrary-HTTP
host tools, and it inherits the full security model (egress guard, redaction, auth on any network
transport, recorded authorization).

## Why
- It matches how Aevrin already meets developers: a Claude Code hook that runs a scan in the developer's
  own agent. The same pattern lets a developer say, inside their coding agent, "use modelWrecker to try to
  break this model" and get a findings summary without leaving the harness.
- MCP is the standard, model-agnostic way for an agent to call an external tool, and modelWrecker already
  speaks MCP for its MCP *targets*, so the client/server plumbing is reused.
- A JSON driver keeps non-MCP harnesses (and plain CI scripts) first-class.

## Alternatives
- **CLI only** - already supported, but a coding agent orchestrates an MCP tool far more smoothly than it
  parses CLI help; the MCP server makes the agent experience first-class.
- **Expose the full tool registry over MCP** - rejected; that is exactly the unauthenticated-host-tool
  mistake the security model forbids. Only safe orchestration tools are exposed.

## Update - 2026-10-02 (guardrails)
This refines the decision; it does not reverse it. The "define a target" tool is not offered: a target
comes only from a config file inside the server's config folder, marked `authorized: true`, and no tool
argument can name or change a target or endpoint. Every tool call passes the MCP guardrail chain (tool
and argument allowlist, rate limits, path scope, target scope, entitlement hook, resource limits). The
built tool list is in [`../mcp/tools.md`](../mcp/tools.md); the guardrails are in
[`../security/mcp.md`](../security/mcp.md).

## Trade-offs
- One more surface to maintain and secure. Mitigated by reusing the MCP SDK, exposing a deliberately small
  safe tool set, and routing everything through the existing security layer. See
  [`../features/harness-integration.md`](../features/harness-integration.md) and
  [`../security/SECURITY.md`](../security/SECURITY.md).
