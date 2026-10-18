import type { Database, Deps, Row } from "../../types/deps";
import { CURRENCY, effectivePlan, planById, type Interval } from "./plans";
import { str } from "../../lib/strings";
import { usageFor } from "../entitlements/usage";

const RENEWAL_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;
// an unpaid order this recent still counts as a payment in progress
const PENDING_ORDER_MS = 60 * 60 * 1000;

type Effective = ReturnType<typeof effectivePlan>;

function subscriptionStatus(isLapsed: boolean, subscription: Row | undefined): string {
  if (!isLapsed) return "active";
  return subscription?.status === "canceled" ? "canceled" : "expired";
}

function paymentStatus(hasRecentOpenOrder: boolean, planId: string): string {
  if (hasRecentOpenOrder) return "pending";
  return planId === "free" ? "not_required" : "paid";
}

function bonusView(bonus: Effective["bonus"]) {
  const hasBonus = bonus.campaigns || bonus.attacks || bonus.devices || bonus.projects;
  if (!hasBonus) return null;
  return { campaigns: bonus.campaigns, attacks: bonus.attacks, devices: bonus.devices, projects: bonus.projects, expiresAt: bonus.expires_at };
}

async function hasRecentOpenOrder(deps: Deps, owner: string, now: Date): Promise<boolean> {
  const [last] = await deps.serviceDb.table("payments").select({
    eq: { owner_id: owner },
    order: { column: "created_at", ascending: false },
    limit: 1,
  });
  return last?.status === "created" && now.getTime() - Date.parse(str(last.created_at)) < PENDING_ORDER_MS;
}

/** The Billing page's view of one account. */
export async function subscriptionView(deps: Deps, db: Database, owner: string) {
  const now = deps.now();
  const [subscription] = await deps.serviceDb.table("subscriptions").select({ eq: { owner_id: owner } });
  const effective = effectivePlan(subscription, now);
  const plan = planById(effective.planId);
  const usage = await usageFor(db, owner, now);
  const recentOpen = await hasRecentOpenOrder(deps, owner, now);
  const paidUntil = effective.periodEnd;
  const isFree = plan.id === "free";
  return {
    planId: plan.id,
    planName: plan.name,
    status: subscriptionStatus(effective.lapsed, subscription),
    paymentStatus: paymentStatus(recentOpen, plan.id),
    lapsedPlanId: effective.lapsed ? effective.storedPlanId : null,
    source: isFree ? "free" : str(subscription?.source) || "admin",
    interval: isFree ? null : ((subscription?.billing_interval as Interval | null) ?? null),
    paidUntil,
    renewalDue: Boolean(paidUntil && Date.parse(paidUntil) - now.getTime() < RENEWAL_NOTICE_MS),
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
    currency: CURRENCY,
    creditPaise: effective.creditPaise,
    bonus: bonusView(effective.bonus),
    limits: effective.limits,
    features: effective.features,
    usage: usage.values,
    billingAvailable: Boolean(deps.billing),
  };
}

// stored order statuses as the dashboard shows them: "created" is an open invoice
function invoiceStatus(status: string): string {
  if (status === "created") return "open";
  return status;
}

/** One payment row as the dashboard's Invoice type. Amounts are in rupees. */
export function invoiceView(payment: Row) {
  return {
    id: str(payment.id),
    number: str(payment.invoice_number),
    amount: Number(payment.amount_paise) / 100,
    listPrice: Number(payment.list_price_paise) / 100,
    creditApplied: Number(payment.credit_applied_paise ?? 0) / 100,
    refunded: Number(payment.amount_refunded_paise ?? 0) / 100,
    currency: str(payment.currency) || CURRENCY,
    status: invoiceStatus(str(payment.status)),
    plan: str(payment.plan),
    interval: str(payment.billing_interval),
    method: str(payment.method),
    periodStart: payment.period_start ? str(payment.period_start) : null,
    periodEnd: payment.period_end ? str(payment.period_end) : null,
    issuedAt: str(payment.paid_at ?? payment.created_at),
  };
}
