"""What a plan allows, as the engine sees it (docs/security/entitlements.md, ADR-0018).

The engine holds no prices and no plan logic beyond this: a signed entitlement from the cloud says
which features are on and how much can run each month. Without a valid one, the engine runs the free
baseline below. The numbers match the Free plan in src/shared/plans.json.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Strategies that need the `advanced_strategies` feature (PyRIT and garak integrations).
ADVANCED_STRATEGIES = frozenset({"pyrit_send", "pyrit_pair", "pyrit_tap", "garak_probe"})
# Strategies and target types that need the `mcp` feature.
MCP_STRATEGIES = frozenset({"mcp_tool_poisoning"})
MCP_TARGET_TYPES = frozenset({"mcp"})

FEATURES = ("advanced_strategies", "mcp", "analytics", "evidence_storage", "enterprise")
METERS = ("campaigns", "attacks", "devices", "projects")


@dataclass(frozen=True)
class Entitlement:
    plan: str
    limits: dict[str, int | None]
    features: dict[str, bool]
    # Usage the cloud had seen this period when it signed: {"period": "YYYY-MM", "campaigns",
    # "attacks"}.
    usage: dict = field(default_factory=dict)
    subject: str = ""
    device: str | None = None
    issued_at: int = 0
    expires_at: int = 0
    plan_ends_at: str | None = None
    key_id: str = ""
    signed: bool = False  # False only for the built-in free baseline

    def allows(self, feature: str) -> bool:
        return bool(self.features.get(feature, False))

    def limit(self, meter: str) -> int | None:
        value = self.limits.get(meter)
        return value if value is None else int(value)

    def strategy_allowed(self, name: str) -> bool:
        if name in ADVANCED_STRATEGIES:
            return self.allows("advanced_strategies")
        if name in MCP_STRATEGIES:
            return self.allows("mcp")
        return True

    def target_allowed(self, target_type: str | None) -> bool:
        return (target_type or "chat") not in MCP_TARGET_TYPES or self.allows("mcp")


FREE_BASELINE = Entitlement(
    plan="free",
    limits={"campaigns": 20, "attacks": 2000, "devices": 1, "projects": 2},
    features={name: False for name in FEATURES},
)
