// Plan configuration, read from the shared src/shared/plans.json (also used by the dashboard and the
// landing page, so a price or limit is set in exactly one place). This file adds the server-side rules:
// which plan is in effect right now, and the limits after an admin bonus.
// See docs/billing/pricing.md and docs/security/entitlements.md.
import config from "../../shared/plans.json";
import type { Row } from "./db";

export type PlanId = "free" | "pro" | "enterprise";
export type Interval = "month" | "year";
export type MeterKey = "campaigns" | "attacks" | "devices" | "projects";
export type FeatureKey = "advanced_strategies" | "mcp" | "analytics" | "evidence_storage" | "enterprise";
export type Limits = Record<MeterKey, number | null>;
export type Features = Record<FeatureKey, boolean>;

export const METERS: MeterKey[] = ["campaigns", "attacks", "devices", "projects"];
export const CURRENCY = config.currency;
export const TAX_NOTE = config.taxNote;
export const INTERVAL_MONTHS: Record<Interval, number> = { month: 1, year: 12 };

interface PlanConfig {
  id: PlanId;
  name: string;
  blurb: string;
  highlighted?: boolean;
  limits: Limits;
  features: Features;
  prices: Record<Interval, number> | null;
}

const RAW = config.plans as PlanConfig[];

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

function priceLabel(p: PlanConfig): string {
  if (p.id === "free") return "Free";
  if (!p.prices) return "Contact sales";
  return `${rupees(p.prices.month)} / month`;
}

/** The plans as the dashboard reads them (GET /plans). */
export const PLANS = RAW.map((p) => ({
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

export function planById(id: string) {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** The price of a purchasable plan and interval in paise, or null when it cannot be bought online. */
export function priceFor(planId: string, interval: Interval): number | null {
  return RAW.find((p) => p.id === planId)?.prices?.[interval] ?? null;
}

export function isPurchasable(planId: string): planId is "pro" {
  return RAW.some((p) => p.id === planId && p.prices !== null);
}

/** Admin-granted extra allowance on top of the plan, stored on the subscription row. */
export interface Bonus {
  campaigns: number;
  attacks: number;
  devices: number;
  projects: number;
  expires_at: string | null;
}

export const NO_BONUS: Bonus = { campaigns: 0, attacks: 0, devices: 0, projects: 0, expires_at: null };

export function readBonus(raw: unknown, now: Date): Bonus {
  if (!raw || typeof raw !== "object") return NO_BONUS;
  const b = raw as Record<string, unknown>;
  const expires = typeof b.expires_at === "string" ? b.expires_at : null;
  if (expires && Date.parse(expires) <= now.getTime()) return NO_BONUS;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return { campaigns: n(b.campaigns), attacks: n(b.attacks), devices: n(b.devices), projects: n(b.projects), expires_at: expires };
}

/** What a subscription row means right now. A paid plan past its end date has lapsed to Free. */
export interface Effective {
  planId: PlanId;
  /** The plan on the row, which differs from planId when it has lapsed. */
  storedPlanId: PlanId;
  lapsed: boolean;
  periodEnd: string | null;
  limits: Limits;
  features: Features;
  bonus: Bonus;
  creditPaise: number;
}

export function effectivePlan(sub: Row | undefined, now: Date): Effective {
  const stored = (planById(String(sub?.plan ?? "free")).id ?? "free") as PlanId;
  const end = sub?.current_period_end ? String(sub.current_period_end) : null;
  const lapsed = stored !== "free" && end !== null && Date.parse(end) <= now.getTime();
  const status = String(sub?.status ?? "active");
  const active = !lapsed && status !== "canceled";
  const planId: PlanId = active ? stored : "free";
  const plan = planById(planId);
  const bonus = readBonus(sub?.bonus, now);
  const limits = { ...plan.limits } as Limits;
  for (const m of METERS) {
    const base = limits[m];
    limits[m] = base === null ? null : base + bonus[m];
  }
  return {
    planId,
    storedPlanId: stored,
    lapsed: lapsed || (stored !== "free" && status === "canceled"),
    periodEnd: planId === "free" ? null : end,
    limits,
    features: { ...plan.features } as Features,
    bonus,
    creditPaise: Math.max(0, Math.floor(Number(sub?.credit_paise ?? 0) || 0)),
  };
}

/** The usage meters reset at the start of each calendar month (UTC). */
export function meterPeriod(now: Date): { start: Date; end: Date; key: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start, end, key };
}

/** Add whole months in UTC, clamping to the last day of a shorter month (Jan 31 + 1 month = Feb 28). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
