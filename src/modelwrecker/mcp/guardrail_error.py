"""The structured error every MCP guardrail raises when it refuses a request."""

from __future__ import annotations


class GuardrailError(Exception):
    """A request refused by a guardrail. Carries a stable code and the check that refused it.

    `check` is the guardrail stage (tool_permission, rate_limit, path_scope, config, target_scope,
    entitlement, resource_limit). `code` is a stable machine-readable reason. `message` is for
    people.
    """

    def __init__(self, message: str, *, check: str = "input",
                 code: str = "invalid_request") -> None:
        super().__init__(message)
        self.message = message
        self.check = check
        self.code = code

    def to_dict(self) -> dict:
        return {"denied": True, "check": self.check, "code": self.code, "message": self.message}

    def __str__(self) -> str:
        return f"denied by {self.check} guardrail ({self.code}): {self.message}"
