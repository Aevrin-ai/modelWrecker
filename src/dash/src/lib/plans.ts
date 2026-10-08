/*
  PLAN CONFIGURATION for the dashboard.

  Tiers, limits, and prices come from src/shared/plans.json, the one file the API and the landing page
  read too (docs/billing/pricing.md). The display rules all three share (paise formatting, the yearly
  saving, the GET /plans shape) live in src/shared/plans.ts. In live mode the Billing page reads plans
  from GET /plans; mock mode uses PLANS below, built from the same file. Components never hard-code a
  plan, a limit, or a price.

  This is display only. Enforcement happens in the control-plane API and in the local engine (signed
  entitlement check), never by hiding a button.
*/

import { PLANS as SHARED_PLANS, yearlySavingPercent } from "../../../shared/plans";
import type { BillingInterval, FeatureKey, MeterKey, Plan } from "@/types";

export { formatPaise } from "../../../shared/plans";

export const METER_LABEL: Record<MeterKey, { label: string; unit: string }> = {
  campaigns: { label: "Campaign runs this month", unit: "runs" },
  attacks: { label: "Attack attempts this month", unit: "attempts" },
  devices: { label: "Connected devices", unit: "devices" },
  projects: { label: "Active projects", unit: "projects" },
};

// The landing page (src/web/src/sections/Pricing.tsx) words these as sales copy on purpose; these are
// the plain product names the Billing page shows.
export const FEATURE_LABEL: Record<FeatureKey, string> = {
  advanced_strategies: "Advanced strategies (PyRIT, garak)",
  mcp: "MCP targets",
  analytics: "Model leaderboard",
  evidence_storage: "Evidence and transcript sync",
  enterprise: "Enterprise controls (SSO, policies, audit logs)",
};

export const METER_ORDER: MeterKey[] = ["campaigns", "attacks", "devices", "projects"];
export const FEATURE_ORDER: FeatureKey[] = ["advanced_strategies", "mcp", "analytics", "evidence_storage", "enterprise"];

export const INTERVAL_LABEL: Record<BillingInterval, string> = { month: "Monthly", year: "Yearly" };

/** How much a yearly price saves against twelve monthly ones, in whole percent. */
export function yearlySaving(plan: Plan): number {
  return yearlySavingPercent(plan.prices && { month: plan.prices.month.amount, year: plan.prices.year.amount });
}

export const PLANS: Plan[] = SHARED_PLANS;

export function planById(id: Plan["id"]): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
