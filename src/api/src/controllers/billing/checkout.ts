import type { z } from "zod";
import type { AppContext } from "../../types/appEnv";
import { gatewayError, requireBilling } from "../../services/billing/gateway";
import { subscriptionView } from "../../services/billing/views";
import { parseBody } from "../../validators/body";
import type { Deps, Row } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { randomToken } from "../../lib/tokens";
import type { KeyLimit } from "../../middleware/rateLimit";
import { CURRENCY, INTERVAL_MONTHS, effectivePlan, isPurchasable, planById, priceFor } from "../../services/billing/plans";
import type { BillingConfig, RzpOrder } from "../../services/razorpay/client";
import { CheckoutReq } from "../../validators/schemas";

type CheckoutBody = z.infer<typeof CheckoutReq>;

/** Razorpay's smallest order is one rupee. */
const MIN_ORDER_PAISE = 100;

/** How much of the price account credit covers, keeping any card charge at or above the smallest order. */
function splitPrice(listPrice: number, creditPaise: number): { credit: number; amount: number } {
  const credit = Math.min(creditPaise, listPrice);
  const amount = listPrice - credit;
  if (amount > 0 && amount < MIN_ORDER_PAISE) return { credit: listPrice - MIN_ORDER_PAISE, amount: MIN_ORDER_PAISE };
  return { credit, amount };
}

async function createRazorpayOrder(billing: BillingConfig, amount: number, notes: Record<string, string>): Promise<RzpOrder> {
  try {
    return await billing.api.createOrder({ amount, currency: CURRENCY, receipt: `mw_${randomToken(12)}`, notes });
  } catch (err) {
    gatewayError(err);
  }
}

function paymentRow(ownerId: string, body: CheckoutBody, price: { listPrice: number; credit: number; amount: number }): Row {
  return {
    owner_id: ownerId,
    plan: body.plan,
    billing_interval: body.interval,
    months: INTERVAL_MONTHS[body.interval],
    list_price_paise: price.listPrice,
    credit_applied_paise: price.credit,
    amount_paise: price.amount,
    currency: CURRENCY,
    status: "created",
  };
}

// paid entirely with account credit: no money moves, so there is nothing for Razorpay to confirm
async function payWithCredit(c: AppContext, deps: Deps, row: Row, now: Date): Promise<Response> {
  const orderId = `credit_${randomToken(12)}`;
  await deps.serviceDb.table("payments").insert({ ...row, razorpay_order_id: orderId, method: "credit" });
  await deps.serviceDb.rpc("fulfil_payment", { p_order_id: orderId, p_payment_id: null, p_method: "credit", p_now: now.toISOString() });
  return c.json({ paidWithCredit: true, subscription: await subscriptionView(deps, c.get("db"), c.get("user").id) });
}

/** Start a purchase: the price always comes from the server's plan config, never from the client. */
export async function checkout(c: AppContext, deps: Deps, limit: KeyLimit): Promise<Response> {
  const billing = requireBilling(deps);
  const user = c.get("user");
  limit(`checkout:${user.id}`, 10, 60_000);
  const body = await parseBody(c, CheckoutReq);
  if (!isPurchasable(body.plan)) throw new ApiError(400, "not_purchasable", "That plan cannot be bought online.");
  const now = deps.now();
  const [subscription] = await deps.serviceDb.table("subscriptions").select({ eq: { owner_id: user.id } });
  const effective = effectivePlan(subscription, now);
  if (effective.planId === "enterprise") {
    throw new ApiError(409, "enterprise_plan", "Your workspace is on Enterprise. Contact us to change it.");
  }
  // isPurchasable above guarantees the plan has a price
  const listPrice = priceFor(body.plan, body.interval) as number;
  const { credit, amount } = splitPrice(listPrice, effective.creditPaise);
  const row = paymentRow(user.id, body, { listPrice, credit, amount });
  if (amount === 0) return payWithCredit(c, deps, row, now);

  const order = await createRazorpayOrder(billing, amount, { owner_id: user.id, plan: body.plan, interval: body.interval });
  await deps.serviceDb.table("payments").insert({ ...row, razorpay_order_id: order.id });
  return c.json({
    paidWithCredit: false,
    orderId: order.id,
    amount,
    currency: CURRENCY,
    creditApplied: credit,
    keyId: billing.keyId,
    description: `${planById(body.plan).name} - ${body.interval === "year" ? "12 months" : "1 month"}`,
    prefill: { email: user.email ?? "", name: user.name ?? "" },
  });
}
