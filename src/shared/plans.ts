/*
  Plan helpers shared by the API (src/api), the dashboard (src/dash), and the landing page (src/web).

  plans.json next to this file is the one source of tiers, limits, and prices (docs/billing/pricing.md).
  This module reads it and holds the display rules every surface must agree on: how paise are shown, how
  the yearly saving is worked out, and the plan shape GET /plans returns. Server-only rules (which plan is
  in effect, admin bonuses) stay in src/api/src/plans.ts.
*/

import config from "./plans.json";

export type PlanId = "free" | "pro" | "enterprise";
export type Interval = "month" | "year";
export type MeterKey = "campaigns" | "attacks" | "devices" | "projects";
export type FeatureKey = "advanced_strategies" | "mcp" | "analytics" | "evidence_storage" | "enterprise";

/** One plan as written in plans.json. Prices are in paise and include GST. */
export interface PlanConfig {
  id: PlanId;
  name: string;
  blurb: string;
  highlighted?: boolean;
  /** null = unlimited. */
  limits: Record<MeterKey, number | null>;
  features: Record<FeatureKey, boolean>;
  /** Present only for a plan that can be bought online. */
  prices: Record<Interval, number> | null;
}

export const CURRENCY: string = config.currency;
export const TAX_NOTE: string = config.taxNote;
export const PLAN_CONFIGS = config.plans as PlanConfig[];

/** "₹899" from 89900 paise. */
export function formatPaise(paise: number, currency = CURRENCY): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);
}

/** How much a yearly price saves against twelve monthly ones, in whole percent. 0 when not for sale. */
export function yearlySavingPercent(prices: Record<Interval, number> | null): number {
  if (!prices) return 0;
  const twelve = prices.month * 12;
  return Math.round(((twelve - prices.year) / twelve) * 100);
}

/** "Free", "₹899 / month", or "Contact sales". */
function priceLabel(p: PlanConfig): string {
  if (p.id === "free") return "Free";
  if (!p.prices) return "Contact sales";
  return `${formatPaise(p.prices.month)} / month`;
}

/** The plans as GET /plans returns them, and as the dashboard shows them in mock mode. */
export const PLANS = PLAN_CONFIGS.map((p) => ({
  id: p.id,
  name: p.name,
  blurb: p.blurb,
  priceLabel: priceLabel(p),
  highlighted: p.highlighted ?? false,
  limits: p.limits,
  features: p.features,
  prices: p.prices
    ? {
        month: { amount: p.prices.month, currency: CURRENCY },
        year: { amount: p.prices.year, currency: CURRENCY },
      }
    : null,
  taxNote: p.prices ? TAX_NOTE : null,
}));
