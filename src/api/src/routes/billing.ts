// Billing routes (issue #12, docs/billing/razorpay.md). Prepaid plans through Razorpay Orders.
//
// Payment success is decided on the server only, in one of two ways, both server-to-server:
//   1. POST /billing/verify: the browser passes the ids Checkout gave it; the server checks Checkout's
//      signature with the key secret AND fetches the payment from Razorpay to confirm it was captured for
//      the right order, amount, and currency.
//   2. POST /billing/webhook: Razorpay calls us; the body's HMAC is checked with the webhook secret.
// Either path calls the fulfil_payment database function, which applies a payment exactly once.
// GET /subscription also reconciles recent unpaid orders, in case the tab closed and a webhook was missed.
import type { Context, Hono, MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { parseBody } from "../body";
import type { Db, Deps, Row } from "../db";
import { ApiError, RateLimiter, randomToken } from "../lib";
import { CURRENCY, INTERVAL_MONTHS, effectivePlan, isPurchasable, planById, priceFor, type Interval } from "../plans";
import {
  RazorpayError,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  type BillingConfig,
  type RzpPayment,
} from "../razorpay";
import { CheckoutReq, VerifyPaymentReq } from "../schemas";
import { usageFor } from "../usage";
import { str } from "./shared";

/** Razorpay's smallest order is one rupee. */
const MIN_ORDER_PAISE = 100;
const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000;
const RENEWAL_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_WEBHOOK_BYTES = 512 * 1024;

function requireBilling(deps: Deps): BillingConfig {
  if (!deps.billing) throw new ApiError(503, "billing_unavailable", "Payments are not available right now. Try again later.");
  return deps.billing;
}

function gatewayError(err: unknown): never {
  if (err instanceof RazorpayError) {
    console.error("razorpay call failed", err.status, err.code);
    throw new ApiError(502, "payment_provider_error", "The payment provider did not respond as expected. Try again shortly.");
  }
  throw err;
}

type ConfirmResult = "paid" | "pending" | "failed" | "mismatch";

/**
 * Apply what Razorpay says about one payment to our order row. Called from verify, the webhook, and
 * reconciliation. Safe to call any number of times for the same payment.
 */
async function confirmPayment(deps: Deps, billing: BillingConfig, order: Row, payment: RzpPayment): Promise<ConfirmResult> {
  const db = deps.serviceDb;
  if (payment.order_id !== order.razorpay_order_id || payment.amount !== Number(order.amount_paise) || payment.currency !== order.currency) {
    console.error("payment does not match its order", str(order.id));
    return "mismatch";
  }
  let p = payment;
  if (p.status === "authorized") {
    try {
      p = await billing.api.capturePayment(p.id, p.amount, p.currency);
    } catch (err) {
      gatewayError(err);
    }
  }
  if (p.status === "captured" || p.status === "refunded") {
    const res = (await db.rpc("fulfil_payment", {
      p_order_id: str(order.razorpay_order_id),
      p_payment_id: p.id,
      p_method: p.method ?? "razorpay",
      p_now: deps.now().toISOString(),
    })) as { ok: boolean };
    if (!res.ok) return "mismatch";
    if (p.status === "refunded" || (p.amount_refunded ?? 0) > 0) {
      await db.rpc("refund_payment", { p_payment_id: p.id, p_amount_refunded: p.amount_refunded ?? p.amount, p_now: deps.now().toISOString() });
    }
    return "paid";
  }
  if (p.status === "failed") {
    await db.table("payments").update({ id: order.id, status: "created" }, { status: "failed", razorpay_payment_id: null });
    return "failed";
  }
  return "pending";
}

/** Look at recent unpaid orders of one account with Razorpay, and apply any that were paid. */
export async function reconcileOwner(deps: Deps, owner: string, limit = 3): Promise<void> {
  if (!deps.billing) return;
  const since = new Date(deps.now().getTime() - RECONCILE_WINDOW_MS).toISOString();
  const open = await deps.serviceDb.table("payments").select({
    eq: { owner_id: owner, status: "created" },
    gte: { created_at: since },
    order: { column: "created_at", ascending: false },
    limit,
  });
  for (const order of open) {
    if (str(order.razorpay_order_id).startsWith("credit_")) continue;
    try {
      const payments = await deps.billing.api.orderPayments(str(order.razorpay_order_id));
      const best = payments.find((p) => p.status === "captured") ?? payments.find((p) => p.status === "authorized");
      if (best) await confirmPayment(deps, deps.billing, order, best);
    } catch (err) {
      // Reconciliation is a backstop; a failure here must never break the Billing page.
      console.error("reconcile failed", err instanceof Error ? err.message : String(err));
    }
  }
}

/** Full refund of one paid order through Razorpay, then record it. Used by the admin console. */
export async function refundOrder(deps: Deps, order: Row, notes: Record<string, string>): Promise<{ refunded: number }> {
  const billing = requireBilling(deps);
  const paymentId = str(order.razorpay_payment_id);
  if (!paymentId) throw new ApiError(409, "not_refundable", "This purchase was paid with account credit; adjust the credit instead.");
  if (order.status !== "paid" && order.status !== "partially_refunded") {
    throw new ApiError(409, "not_refundable", "Only a paid purchase can be refunded.");
  }
  try {
    const refund = await billing.api.refund(paymentId, notes);
    const total = Number(order.amount_refunded_paise ?? 0) + Number(refund.amount ?? order.amount_paise);
    await deps.serviceDb.rpc("refund_payment", { p_payment_id: paymentId, p_amount_refunded: total, p_now: deps.now().toISOString() });
    return { refunded: total };
  } catch (err) {
    gatewayError(err);
  }
}

/** The Billing page's view of one account. */
async function subscriptionView(deps: Deps, db: Db, owner: string) {
  const now = deps.now();
  const [sub] = await deps.serviceDb.table("subscriptions").select({ eq: { owner_id: owner } });
  const eff = effectivePlan(sub, now);
  const plan = planById(eff.planId);
  const usage = await usageFor(db, owner, now);
  const [last] = await deps.serviceDb.table("payments").select({
    eq: { owner_id: owner },
    order: { column: "created_at", ascending: false },
    limit: 1,
  });
  const recentOpen = last?.status === "created" && now.getTime() - Date.parse(str(last.created_at)) < 60 * 60 * 1000;
  const paidUntil = eff.periodEnd;
  return {
    planId: plan.id,
    planName: plan.name,
    status: eff.lapsed ? (sub?.status === "canceled" ? "canceled" : "expired") : "active",
    paymentStatus: recentOpen ? "pending" : plan.id === "free" ? "not_required" : "paid",
    lapsedPlanId: eff.lapsed ? eff.storedPlanId : null,
    source: plan.id === "free" ? "free" : str(sub?.source) || "admin",
    interval: plan.id === "free" ? null : ((sub?.billing_interval as Interval | null) ?? null),
    paidUntil,
    renewalDue: Boolean(paidUntil && Date.parse(paidUntil) - now.getTime() < RENEWAL_NOTICE_MS),
    periodStart: usage.periodStart,
    periodEnd: usage.periodEnd,
    currency: CURRENCY,
    creditPaise: eff.creditPaise,
    bonus:
      eff.bonus.campaigns || eff.bonus.attacks || eff.bonus.devices || eff.bonus.projects
        ? { campaigns: eff.bonus.campaigns, attacks: eff.bonus.attacks, devices: eff.bonus.devices, projects: eff.bonus.projects, expiresAt: eff.bonus.expires_at }
        : null,
    limits: eff.limits,
    features: eff.features,
    usage: usage.values,
    billingAvailable: Boolean(deps.billing),
  };
}

export function invoiceView(p: Row) {
  return {
    id: str(p.id),
    number: str(p.invoice_number),
    amount: Number(p.amount_paise) / 100,
    listPrice: Number(p.list_price_paise) / 100,
    creditApplied: Number(p.credit_applied_paise ?? 0) / 100,
    refunded: Number(p.amount_refunded_paise ?? 0) / 100,
    currency: str(p.currency) || CURRENCY,
    status: str(p.status) === "paid" ? "paid" : str(p.status) === "created" ? "open" : str(p.status),
    plan: str(p.plan),
    interval: str(p.billing_interval),
    method: str(p.method),
    periodStart: p.period_start ? str(p.period_start) : null,
    periodEnd: p.period_end ? str(p.period_end) : null,
    issuedAt: str(p.paid_at ?? p.created_at),
  };
}

export function registerBillingRoutes(app: Hono<AppEnv>, deps: Deps, requireUser: MiddlewareHandler<AppEnv>) {
  const limiter = new RateLimiter();
  const limit = (key: string, max: number) => {
    if (!limiter.allow(key, max, 60_000, deps.now().getTime())) {
      throw new ApiError(429, "rate_limited", "Too many requests. Slow down and try again.");
    }
  };

  app.get("/subscription", requireUser, async (c) => {
    const owner = c.get("user").id;
    await reconcileOwner(deps, owner);
    return c.json(await subscriptionView(deps, c.get("db"), owner));
  });

  app.get("/invoices", requireUser, async (c) => {
    const owner = c.get("user").id;
    const rows = await c.get("db").table("payments").select({
      eq: { owner_id: owner },
      in: { column: "status", values: ["paid", "refunded", "partially_refunded"] },
      order: { column: "paid_at", ascending: false },
      limit: 100,
    });
    return c.json(rows.map(invoiceView));
  });

  app.post("/billing/checkout", requireUser, async (c) => {
    const billing = requireBilling(deps);
    const user = c.get("user");
    limit(`checkout:${user.id}`, 10);
    const body = await parseBody(c, CheckoutReq);
    if (!isPurchasable(body.plan)) throw new ApiError(400, "not_purchasable", "That plan cannot be bought online.");
    const now = deps.now();
    const [sub] = await deps.serviceDb.table("subscriptions").select({ eq: { owner_id: user.id } });
    const eff = effectivePlan(sub, now);
    if (eff.planId === "enterprise") {
      throw new ApiError(409, "enterprise_plan", "Your workspace is on Enterprise. Contact us to change it.");
    }
    const listPrice = priceFor(body.plan, body.interval)!;
    let credit = Math.min(eff.creditPaise, listPrice);
    let amount = listPrice - credit;
    if (amount > 0 && amount < MIN_ORDER_PAISE) {
      credit = listPrice - MIN_ORDER_PAISE;
      amount = MIN_ORDER_PAISE;
    }
    const row = {
      owner_id: user.id,
      plan: body.plan,
      billing_interval: body.interval,
      months: INTERVAL_MONTHS[body.interval],
      list_price_paise: listPrice,
      credit_applied_paise: credit,
      amount_paise: amount,
      currency: CURRENCY,
      status: "created",
    };

    if (amount === 0) {
      // Paid entirely with account credit: no money moves, so there is nothing for Razorpay to confirm.
      const orderId = `credit_${randomToken(12)}`;
      await deps.serviceDb.table("payments").insert({ ...row, razorpay_order_id: orderId, method: "credit" });
      await deps.serviceDb.rpc("fulfil_payment", { p_order_id: orderId, p_payment_id: null, p_method: "credit", p_now: now.toISOString() });
      return c.json({ paidWithCredit: true, subscription: await subscriptionView(deps, c.get("db"), user.id) });
    }

    let order;
    try {
      order = await billing.api.createOrder({
        amount,
        currency: CURRENCY,
        receipt: `mw_${randomToken(12)}`,
        notes: { owner_id: user.id, plan: body.plan, interval: body.interval },
      });
    } catch (err) {
      gatewayError(err);
    }
    await deps.serviceDb.table("payments").insert({ ...row, razorpay_order_id: order.id });
    const plan = planById(body.plan);
    return c.json({
      paidWithCredit: false,
      orderId: order.id,
      amount,
      currency: CURRENCY,
      creditApplied: credit,
      keyId: billing.keyId,
      description: `${plan.name} - ${body.interval === "year" ? "12 months" : "1 month"}`,
      prefill: { email: user.email ?? "", name: user.name ?? "" },
    });
  });

  app.post("/billing/verify", requireUser, async (c) => {
    const billing = requireBilling(deps);
    const user = c.get("user");
    limit(`verify:${user.id}`, 20);
    const body = await parseBody(c, VerifyPaymentReq);
    const [order] = await deps.serviceDb.table("payments").select({ eq: { razorpay_order_id: body.razorpay_order_id, owner_id: user.id } });
    if (!order) throw new ApiError(404, "unknown_order", "That order was not found.");
    if (!(await verifyCheckoutSignature(billing.keySecret, body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature))) {
      throw new ApiError(400, "invalid_signature", "The payment could not be verified.");
    }
    let payment: RzpPayment;
    try {
      payment = await billing.api.fetchPayment(body.razorpay_payment_id);
    } catch (err) {
      gatewayError(err);
    }
    const result = await confirmPayment(deps, billing, order, payment);
    if (result === "mismatch") throw new ApiError(400, "payment_mismatch", "The payment does not match this order.");
    return c.json({ status: result, subscription: await subscriptionView(deps, c.get("db"), user.id) });
  });

  // Razorpay -> us. No user session: the HMAC over the raw body is the authentication.
  app.post("/billing/webhook", async (c: Context<AppEnv>) => {
    const billing = deps.billing;
    if (!billing?.webhookSecret) throw new ApiError(503, "billing_unavailable", "Webhooks are not configured.");
    limit(`webhook:${c.req.header("cf-connecting-ip") ?? "local"}`, 300);
    const raw = await c.req.text();
    if (raw.length > MAX_WEBHOOK_BYTES) throw new ApiError(413, "payload_too_large", "Request body is too large.");
    const signature = c.req.header("x-razorpay-signature") ?? "";
    if (!signature || !(await verifyWebhookSignature(billing.webhookSecret, raw, signature))) {
      console.error("webhook signature rejected");
      throw new ApiError(400, "invalid_signature", "Signature check failed.");
    }
    let event: { event?: string; payload?: Record<string, { entity?: Record<string, unknown> }> };
    try {
      event = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "invalid_json", "Request body must be JSON.");
    }
    const eventId = c.req.header("x-razorpay-event-id") ?? "";
    const events = deps.serviceDb.table("billing_events");
    if (eventId && (await events.count({ eq: { event_id: eventId } })) > 0) return c.json({ ok: true, duplicate: true });

    const name = str(event.event);
    const payment = event.payload?.payment?.entity as RzpPayment | undefined;
    if (payment && ["payment.captured", "payment.authorized", "order.paid", "payment.failed"].includes(name)) {
      const [order] = await deps.serviceDb.table("payments").select({ eq: { razorpay_order_id: str(payment.order_id) } });
      if (order) await confirmPayment(deps, billing, order, payment);
    } else if (name === "refund.processed" || name === "payment.refunded") {
      const refund = event.payload?.refund?.entity as { payment_id?: string; amount?: number } | undefined;
      const paymentId = str(payment?.id ?? refund?.payment_id);
      const refunded = Number(payment?.amount_refunded ?? refund?.amount ?? 0);
      if (paymentId && refunded > 0) {
        await deps.serviceDb.rpc("refund_payment", { p_payment_id: paymentId, p_amount_refunded: refunded, p_now: deps.now().toISOString() });
      }
    }
    if (eventId) await events.insert({ event_id: eventId.slice(0, 120), event: name.slice(0, 60) }).catch(() => undefined);
    return c.json({ ok: true });
  });
}
