"""The entitlement hook the MCP guard asks before a run (see docs/security/entitlements.md)."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class EntitlementDecision:
    allowed: bool
    reason: str = ""


@runtime_checkable
class EntitlementChecker(Protocol):
    """Answers one question: can this operation run?

    The local default allows everything. A cloud checker verifies a signed, scoped entitlement. A
    checker holds no pricing logic; it only says allowed or denied.
    """

    def check(self, operation: str, context: Mapping[str, object]) -> EntitlementDecision: ...


class LocalEntitlements:
    """The local default: every operation is allowed. No cloud call is made or faked."""

    def check(self, operation: str, context: Mapping[str, object]) -> EntitlementDecision:
        return EntitlementDecision(allowed=True, reason="local mode")
