"""Harness integration over MCP: let Claude Code / Codex / any MCP client drive modelWrecker.

Exposes only SAFE orchestration tools (no shell, no file write, no arbitrary HTTP). See ADR-0013 and
docs/features/harness-integration.md. The `service` module holds the plain, testable functions; the
`server` module wraps them as MCP tools.
"""

from .guardrails import (
    EntitlementChecker,
    EntitlementDecision,
    GuardrailError,
    LocalEntitlements,
    McpLimits,
)
from .service import McpService

__all__ = [
    "McpService",
    "GuardrailError",
    "McpLimits",
    "EntitlementChecker",
    "EntitlementDecision",
    "LocalEntitlements",
]
