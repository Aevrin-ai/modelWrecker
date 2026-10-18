// plan display from src/shared/plans.json; enforcement lives in the API and the engine, never in a hidden button

import { PLANS as SHARED_PLANS, yearlySavingPercent } from "../../../shared/plans";
import type { BillingInterval, FeatureKey, MeterKey, Plan } from "@/types";

export { formatPaise } from "../../../shared/plans";

export const METER_LABEL: Record<MeterKey, { label: string; unit: string }> = {
  campaigns: { label: "Campaign runs this month", unit: "runs" },
  attacks: { label: "Attack attempts this month", unit: "attempts" },
  devices: { label: "Connected devices", unit: "devices" },
  projects: { label: "Active projects", unit: "projects" },
};

// plain product names for the Billing page; the landing page words these as sales copy on purpose
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

// how much a yearly price saves against twelve monthly ones, in whole percent
export function yearlySaving(plan: Plan): number {
  return yearlySavingPercent(plan.prices && { month: plan.prices.month.amount, year: plan.prices.year.amount });
}

export const PLANS: Plan[] = SHARED_PLANS;

export function planById(id: Plan["id"]): Plan {
  return PLANS.find((plan) => plan.id === id) ?? PLANS[0];
}
