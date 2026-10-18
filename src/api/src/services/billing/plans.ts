// server-side plan rules (the plan in effect, limits after a bonus); prices live once in src/shared/plans.json
import { PLANS, PLAN_CONFIGS, type FeatureKey, type Interval, type MeterKey, type PlanId } from "../../../../shared/plans";
import type { Row } from "../../types/deps";

export { CURRENCY, PLANS } from "../../../../shared/plans";
export type { Interval, MeterKey, PlanId } from "../../../../shared/plans";
export type Limits = Record<MeterKey, number | null>;
export type Features = Record<FeatureKey, boolean>;

const METERS: MeterKey[] = ["campaigns", "attacks", "devices", "projects"];
export const INTERVAL_MONTHS: Record<Interval, number> = { month: 1, year: 12 };

export function planById(id: string) {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

/** The price of a purchasable plan and interval in paise, or null when it cannot be bought online. */
export function priceFor(planId: string, interval: Interval): number | null {
  return PLAN_CONFIGS.find((p) => p.id === planId)?.prices?.[interval] ?? null;
}

export function isPurchasable(planId: string): planId is "pro" {
  return PLAN_CONFIGS.some((p) => p.id === planId && p.prices !== null);
}

/** Admin-granted extra allowance on top of the plan, stored on the subscription row. */
interface Bonus {
  campaigns: number;
  attacks: number;
  devices: number;
  projects: number;
  expires_at: string | null;
}

const NO_BONUS: Bonus = { campaigns: 0, attacks: 0, devices: 0, projects: 0, expires_at: null };

// a stored bonus is trusted only as a positive whole number; anything else counts as none
function bonusCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function readBonus(raw: unknown, now: Date): Bonus {
  if (!raw || typeof raw !== "object") return NO_BONUS;
  const bonus = raw as Record<string, unknown>;
  const expires = typeof bonus.expires_at === "string" ? bonus.expires_at : null;
  if (expires && Date.parse(expires) <= now.getTime()) return NO_BONUS;
  return {
    campaigns: bonusCount(bonus.campaigns),
    attacks: bonusCount(bonus.attacks),
    devices: bonusCount(bonus.devices),
    projects: bonusCount(bonus.projects),
    expires_at: expires,
  };
}

/** What a subscription row means right now. A paid plan past its end date has lapsed to Free. */
interface Effective {
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
  for (const meter of METERS) {
    const base = limits[meter];
    limits[meter] = base === null ? null : base + bonus[meter];
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
