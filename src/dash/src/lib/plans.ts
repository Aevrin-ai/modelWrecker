/*
  PLAN CONFIGURATION - the single place plan tiers are defined for the dashboard.

  Components never hard-code a plan, a limit, or a price. They read this file (through
  the api layer for the user's current plan). Tiers follow docs/security/entitlements.md:
  Free / Pro / Enterprise.

  IMPORTANT:
  - Every number below is a PLACEHOLDER and is configurable. The real limits are set by
    the server-side billing config and delivered as a signed entitlement.
  - No price is set here. Pricing is not decided; the UI shows `priceLabel` only.
  - This is display only. Enforcement happens in the control-plane API and in the local
    engine (signed entitlement check), never by hiding a button.
*/

import type { FeatureKey, MeterKey, Plan } from "@/types";

/** Shown next to any limit so nobody mistakes a placeholder for a commitment. */
export const PLACEHOLDER_NOTE = "Placeholder limit - configurable";

export const METER_LABEL: Record<MeterKey, { label: string; unit: string }> = {
  campaigns: { label: "Campaigns this period", unit: "campaigns" },
  attacks: { label: "Attack attempts this period", unit: "attempts" },
  devices: { label: "Connected devices", unit: "devices" },
  projects: { label: "Projects", unit: "projects" },
};

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  advanced_strategies: "Advanced strategies (PyRIT, garak)",
  mcp: "MCP targets",
  analytics: "Richer analytics and leaderboard",
  evidence_storage: "Optional detailed evidence sync",
  enterprise: "Enterprise controls (SSO, policies, audit logs)",
};

export const METER_ORDER: MeterKey[] = ["campaigns", "attacks", "devices", "projects"];
export const FEATURE_ORDER: FeatureKey[] = [
  "advanced_strategies",
  "mcp",
  "analytics",
  "evidence_storage",
  "enterprise",
];

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Local engine, core strategies, basic dashboard. Fully usable with free, self-hosted parts.",
    priceLabel: "Free",
    limits: { campaigns: 5, attacks: 1000, devices: 1, projects: 2 },
    features: {
      advanced_strategies: false,
      mcp: false,
      analytics: false,
      evidence_storage: false,
      enterprise: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "More campaigns and devices, advanced strategies, MCP targets, richer analytics.",
    priceLabel: "Set in billing config",
    highlighted: true,
    limits: { campaigns: 50, attacks: 25000, devices: 10, projects: 25 },
    features: {
      advanced_strategies: true,
      mcp: true,
      analytics: true,
      evidence_storage: true,
      enterprise: false,
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "Organizations, policy controls, audit logs, SSO, compliance.",
    priceLabel: "Contact sales",
    limits: { campaigns: null, attacks: null, devices: null, projects: null },
    features: {
      advanced_strategies: true,
      mcp: true,
      analytics: true,
      evidence_storage: true,
      enterprise: true,
    },
  },
];

export function planById(id: Plan["id"]): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
