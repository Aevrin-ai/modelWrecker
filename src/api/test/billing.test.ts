// billing (issue #12) and pricing (#42), offline with a fake Razorpay
import { beforeEach, describe, expect, it } from "vitest";
import type { EntitlementSigner } from "../src/services/entitlements/signing";
import { MARGIN_BAND, priceTable } from "../src/services/billing/pricing";
import { BillingHarness, KEY_SECRET, MONTH, YEAR, testSigner } from "./billingHarness";
import { readJson } from "./harness";

interface PlanBody {
  id: string;
  priceLabel: string;
  prices: { month: { amount: number; currency: string }; year: { amount: number } };
}

let signer: EntitlementSigner;
let billing: BillingHarness;

beforeEach(async () => {
  signer ??= await testSigner();
  billing = new BillingHarness(signer);
});

describe("pricing (issue #42)", () => {
  it("keeps every paid price inside the 30-40% margin band", () => {
    const table = priceTable();
    expect(table.length).toBeGreaterThan(0);
    for (const row of table) {
      expect(row.margin, `${row.plan}/${row.interval}`).toBeGreaterThanOrEqual(MARGIN_BAND.min);
      expect(row.margin, `${row.plan}/${row.interval}`).toBeLessThanOrEqual(MARGIN_BAND.max);
    }
  });

  it("publishes plans and prices without sign-in", async () => {
    const plans = await billing.callJson<PlanBody[]>("GET", "/plans");
    const pro = plans.find((plan) => plan.id === "pro");
    expect(pro?.prices.month).toEqual({ amount: MONTH, currency: "INR" });
    expect(pro?.prices.year.amount).toBe(YEAR);
    expect(pro?.priceLabel).toContain("899");
    expect(plans.find((plan) => plan.id === "enterprise")?.priceLabel).toBe("Contact sales");
  });
});

describe("checkout and server-side confirmation (issue #12)", () => {
  it("answers 503 when billing is not configured", async () => {
    billing.app = billing.makeApp({ billing: undefined });
    const res = await billing.call("POST", "/billing/checkout", { token: "token-a", body: { plan: "pro", interval: "month" } });
    expect(res.status).toBe(503);
  });

  it("creates an order for the configured price and never trusts the client for the amount", async () => {
    const bad = await billing.call("POST", "/billing/checkout", { token: "token-a", body: { plan: "pro", interval: "month", amount: 1 } });
    expect(bad.status).toBe(422);
    const order = await billing.checkout("token-a");
    expect(order).toMatchObject({ amount: MONTH, currency: "INR", keyId: "rzp_test_key", creditApplied: 0 });
    expect(JSON.stringify(order)).not.toContain(KEY_SECRET);
    expect(billing.rzp.orders.get(order.orderId)!.amount).toBe(MONTH);
  });

  it("upgrades only after the signature AND Razorpay's record check out, exactly once", async () => {
    const order = await billing.checkout("token-a");
    const payment = billing.rzp.pay(order.orderId);

    const forged = await billing.verify("token-a", order.orderId, payment, "0".repeat(64));
    expect(forged.status).toBe(400);
    expect(billing.db.table("payments").rows[0].status).toBe("created");

    const confirmed = await readJson<{ status: string; subscription: { paidUntil: string } }>(await billing.verify("token-a", order.orderId, payment));
    expect(confirmed.status).toBe("paid");
    expect(confirmed.subscription).toMatchObject({ planId: "pro", status: "active", interval: "month", source: "payment" });
    expect(confirmed.subscription.paidUntil).toBe("2026-11-02T10:00:00.000Z");

    // the browser retries and the webhook arrives too: still one month, one invoice
    await billing.verify("token-a", order.orderId, payment);
    await billing.webhook({ event: "payment.captured", payload: { payment: { entity: payment } } });
    expect((await billing.subscription()).paidUntil).toBe("2026-11-02T10:00:00.000Z");
    const invoices = await billing.callJson<{ number: string }[]>("GET", "/invoices", { token: "token-a" });
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ amount: 899, status: "paid", interval: "month" });
    expect(invoices[0].number).toMatch(/^AEV-2026-\d{6}$/);
  });

  it("refuses a payment whose amount does not match the order", async () => {
    const order = await billing.checkout("token-a");
    const payment = billing.rzp.pay(order.orderId, { amount: 100 });
    const res = await billing.verify("token-a", order.orderId, payment);
    expect(res.status).toBe(400);
    expect((await billing.subscription()).planId).toBe("free");
  });

  it("will not confirm another account's order", async () => {
    const order = await billing.checkout("token-a");
    const payment = billing.rzp.pay(order.orderId);
    const res = await billing.verify("token-b", order.orderId, payment);
    expect(res.status).toBe(404);
  });

  it("adds a renewal to the end date, and a year to a yearly purchase", async () => {
    const first = await billing.checkout("token-a");
    await billing.verify("token-a", first.orderId, billing.rzp.pay(first.orderId));
    billing.clock = Date.parse("2026-10-20T00:00:00Z");
    const second = await billing.checkout("token-a", "year");
    expect(second.amount).toBe(YEAR);
    await billing.verify("token-a", second.orderId, billing.rzp.pay(second.orderId));
    const subscription = await billing.subscription();
    expect(subscription.paidUntil).toBe("2027-11-02T10:00:00.000Z");
    expect(subscription.interval).toBe("year");
  });

  it("lapses to Free when the paid period ends", async () => {
    const order = await billing.checkout("token-a");
    await billing.verify("token-a", order.orderId, billing.rzp.pay(order.orderId));
    billing.clock = Date.parse("2026-11-01T10:00:00Z");
    expect((await billing.subscription()).renewalDue).toBe(true);
    billing.clock = Date.parse("2026-11-03T00:00:00Z");
    const subscription = await billing.subscription();
    expect(subscription).toMatchObject({ planId: "free", status: "expired", lapsedPlanId: "pro" });
  });

  it("applies account credit at checkout, and pays fully from credit when it covers the price", async () => {
    await billing.db.rpc("adjust_credit", { p_owner: "user-a", p_delta: 50000, p_reason: "goodwill", p_actor: "admin:x@aevrin.net" });
    const order = await billing.checkout("token-a");
    expect(order.amount).toBe(MONTH - 50000);
    expect(order.creditApplied).toBe(50000);
    await billing.verify("token-a", order.orderId, billing.rzp.pay(order.orderId));
    expect((await billing.subscription()).creditPaise).toBe(0);

    await billing.db.rpc("adjust_credit", { p_owner: "user-a", p_delta: 100000, p_reason: "promo", p_actor: "admin:x@aevrin.net" });
    const res = await billing.checkout("token-a");
    expect(res.paidWithCredit).toBe(true);
    expect(res.subscription.creditPaise).toBe(100000 - MONTH);
    expect(res.subscription.paidUntil).toBe("2026-12-02T10:00:00.000Z");
  });

  it("reconciles a paid order when neither the browser nor the webhook reported it", async () => {
    const order = await billing.checkout("token-a");
    // the tab closed after paying
    billing.rzp.pay(order.orderId);
    expect((await billing.subscription()).planId).toBe("pro");
  });
});

describe("webhooks (issue #12)", () => {
  it("rejects a bad signature and changes nothing", async () => {
    const order = await billing.checkout("token-a");
    const payment = billing.rzp.pay(order.orderId);
    const res = await billing.webhook({ event: "order.paid", payload: { payment: { entity: payment } } }, "evt_1", "wrong-secret");
    expect(res.status).toBe(400);
    expect(billing.db.table("payments").rows[0].status).toBe("created");
  });

  it("applies order.paid once, and skips a repeated event id", async () => {
    const order = await billing.checkout("token-a");
    const payment = billing.rzp.pay(order.orderId);
    const event = { event: "order.paid", payload: { payment: { entity: payment } } };
    expect((await readJson<{ ok: boolean }>(await billing.webhook(event, "evt_same"))).ok).toBe(true);
    expect((await readJson<{ duplicate: boolean }>(await billing.webhook(event, "evt_same"))).duplicate).toBe(true);
    expect(billing.db.table("payments").rows[0].status).toBe("paid");
    expect((await billing.subscription()).paidUntil).toBe("2026-11-02T10:00:00.000Z");
  });

  it("takes back the time a fully refunded payment bought", async () => {
    const order = await billing.checkout("token-a");
    const payment = billing.rzp.pay(order.orderId);
    await billing.verify("token-a", order.orderId, payment);
    await billing.webhook({
      event: "refund.processed",
      payload: { refund: { entity: { payment_id: payment.id, amount: MONTH } }, payment: { entity: { ...payment, amount_refunded: MONTH } } },
    });
    expect(billing.db.table("payments").rows[0].status).toBe("refunded");
    expect((await billing.subscription()).planId).toBe("free");
  });

  it("answers 503 when no webhook secret is set", async () => {
    billing.app = billing.makeApp({ billing: { keyId: "k", keySecret: KEY_SECRET, webhookSecret: "", api: billing.rzp } });
    expect((await billing.webhook({ event: "order.paid" })).status).toBe(503);
  });
});
