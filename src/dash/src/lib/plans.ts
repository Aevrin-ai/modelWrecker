/*
  PLAN CONFIGURATION for the dashboard.

  Tiers, limits, and prices come from src/shared/plans.json, the one file the API and the landing page
  read too (docs/billing/pricing.md). In live mode the Billing page reads plans from GET /plans; mock mode
  uses PLANS below, built from the same file. Components never hard-code a plan, a limit, or a price.

  This is display only. Enforcement happens in the control-plane API and in the local engine (signed
  entitlement check), never by hiding a button.
*/

import config from "../../../shared/plans.json";
import type { BillingInterval, FeatureKey, MeterKey, Plan } from "@/types";

export const CURRENCY = config.currency;
export const TAX_NOTE = config.taxNote;

export const METER_LABEL: Record<MeterKey, { label: string; unit: string }> = {
  campaigns: { label: "Campaign runs this month", unit: "runs" },
  attacks: { label: "Attack attempts this month", unit: "attempts" },
  devices: { label: "Connected devices", unit: "devices" },
  projects: { label: "Active projects", unit: "projects" },
};

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

/** "₹899" from 89900 paise. */
export function formatPaise(paise: number, currency = CURRENCY): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);
}

/** How much a yearly price saves against twelve monthly ones, in whole percent. */
export function yearlySaving(plan: Plan): number {
  if (!plan.prices) return 0;
  const twelve = plan.prices.month.amount * 12;
  return Math.round(((twelve - plan.prices.year.amount) / twelve) * 100);
}

interface PlanConfig {
  id: Plan["id"];
  name: string;
  blurb: string;
  highlighted?: boolean;
  limits: Record<MeterKey, number | null>;
  features: Record<FeatureKey, boolean>;
  prices: Record<BillingInterval, number> | null;
}

export const PLANS: Plan[] = (config.plans as PlanConfig[]).map((p) => ({
  id: p.id,
  name: p.name,
  blurb: p.blurb,
  highlighted: p.highlighted ?? false,
  priceLabel: p.id === "free" ? "Free" : p.prices ? `${formatPaise(p.prices.month)} / month` : "Contact sales",
  limits: p.limits,
  features: p.features,
  prices: p.prices
    ? { month: { amount: p.prices.month, currency: CURRENCY }, year: { amount: p.prices.year, currency: CURRENCY } }
    : null,
  taxNote: p.prices ? TAX_NOTE : null,
}));

export function planById(id: Plan["id"]): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
