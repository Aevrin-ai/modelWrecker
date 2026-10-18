import type { BillingInterval, CheckoutStart } from "@/types";
import * as mock from "@/data/mock";
import { PLANS } from "@/lib/plans";
import { delay } from "./mockMode";

// the demo never opens Razorpay: a purchase is "paid" from demo credit so the flow can be previewed
export async function payFromDemoCredit(planId: "pro", interval: BillingInterval): Promise<CheckoutStart> {
  const plan = PLANS.find((candidate) => candidate.id === planId)!;
  const months = interval === "year" ? 12 : 1;
  const paidUntil = mock.subscription.paidUntil ? new Date(mock.subscription.paidUntil) : new Date();
  paidUntil.setMonth(paidUntil.getMonth() + months);
  mock.subscription.paidUntil = paidUntil.toISOString();
  mock.subscription.interval = interval;
  mock.subscription.creditPaise = Math.max(0, mock.subscription.creditPaise - (plan.prices?.[interval].amount ?? 0));
  return delay({ paidWithCredit: true as const, subscription: structuredClone(mock.subscription) }, 400);
}
