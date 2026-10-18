// plan display rules shared by the API, dashboard and landing page; plans.json is the one source of tiers and prices

import config from "./plans.json";

export type PlanId = "free" | "pro" | "enterprise";
export type Interval = "month" | "year";
export type MeterKey = "campaigns" | "attacks" | "devices" | "projects";
export type FeatureKey = "advanced_strategies" | "mcp" | "analytics" | "evidence_storage" | "enterprise";

// one plan as written in plans.json; prices are in paise, include GST, and are null when not sold online
export interface PlanConfig {
  id: PlanId;
  name: string;
  blurb: string;
  highlighted?: boolean;
  // null means unlimited
  limits: Record<MeterKey, number | null>;
  features: Record<FeatureKey, boolean>;
  prices: Record<Interval, number> | null;
}

export const CURRENCY: string = config.currency;
export const TAX_NOTE: string = config.taxNote;
export const PLAN_CONFIGS = config.plans as PlanConfig[];

// 89900 paise -> "₹899"
export function formatPaise(paise: number, currency = CURRENCY): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(paise / 100);
}

// how much a yearly price saves against twelve monthly ones, in whole percent; 0 when not for sale
export function yearlySavingPercent(prices: Record<Interval, number> | null): number {
  if (!prices) return 0;
  const twelve = prices.month * 12;
  return Math.round(((twelve - prices.year) / twelve) * 100);
}

// for example "Free", "₹899 / month" or "Contact sales"
function priceLabel(p: PlanConfig): string {
  if (p.id === "free") return "Free";
  if (!p.prices) return "Contact sales";
  return `${formatPaise(p.prices.month)} / month`;
}

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
