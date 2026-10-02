"""Signed entitlements, engine side (issue #11, docs/security/entitlements.md, ADR-0018).

The cloud signs what a plan allows; the engine verifies the signature offline and enforces it before
a run. With no valid entitlement the engine runs the free baseline. There is no price or billing
logic here.
"""

from __future__ import annotations

from .gate import EntitlementDenied, RunAllowance, check_run, record_run
from .model import ADVANCED_STRATEGIES, FREE_BASELINE, MCP_STRATEGIES, Entitlement
from .store import ENV_TOKEN, clear_token, effective_usage, load, save_token
from .token import EntitlementError, verify_token

__all__ = [
    "ADVANCED_STRATEGIES",
    "ENV_TOKEN",
    "FREE_BASELINE",
    "MCP_STRATEGIES",
    "Entitlement",
    "EntitlementDenied",
    "EntitlementError",
    "RunAllowance",
    "check_run",
    "clear_token",
    "effective_usage",
    "load",
    "record_run",
    "save_token",
    "verify_token",
]
