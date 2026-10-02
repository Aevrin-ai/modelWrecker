// Billing (issue #12), pricing (#42), and signed entitlements (#11), offline with a fake Razorpay.
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { MemoryDb } from "../src/db/memory";
import type { AuthUser, Deps } from "../src/db";
import { createSigner, verifyToken, type EntitlementSigner } from "../src/entitlements";
import { MARGIN_BAND, priceTable } from "../src/pricing";
import { hmacSha256Hex, type RazorpayApi, type RzpPayment } from "../src/razorpay";

const USERS: Record<string, AuthUser> = {
  "token-a": { id: "user-a", email: "a@example.com", name: "Alice" },
  "token-b": { id: "user-b", email: "b@example.com", name: "Bob" },
};
const KEY_SECRET = "test_key_secret_value";
const WEBHOOK_SECRET = "test_webhook_secret_value";
const MONTH = 89900;
const YEAR = 989900;

/** Razorpay in memory. `pay(orderId)` plays the customer completing Checkout. */
class FakeRazorpay implements RazorpayApi {
  orders = new Map<string, { id: string; amount: number; currency: string; status: string }>();
  payments = new Map<string, RzpPayment>();
  refunds: string[] = [];
  private n = 0;

  async createOrder(input: { amount: number; currency: string }) {
    const id = `order_TEST${String(++this.n).padStart(8, "0")}`;
    const order = { id, amount: input.amount, currency: input.currency, status: "created" };
    this.orders.set(id, order);
    return { ...order };
  }
  async fetchPayment(id: string) {
    const p = this.payments.get(id);
    if (!p) throw new Error("no such payment");
    return { ...p };
  }
  async capturePayment(id: string) {
    const p = this.payments.get(id)!;
    p.status = "captured";
    return { ...p };
  }
  async orderPayments(orderId: string) {
    return [...this.payments.values()].filter((p) => p.order_id === orderId).map((p) => ({ ...p }));
  }
  async refund(id: string) {
    const p = this.payments.get(id)!;
    p.status = "refunded";
    p.amount_refunded = p.amount;
    this.refunds.push(id);
    return { id: `rfnd_TEST${this.refunds.length}`, status: "processed", amount: p.amount };
  }
  pay(orderId: string, over: Partial<RzpPayment> = {}): RzpPayment {
    const order = this.orders.get(orderId)!;
    const p: RzpPayment = {
      id: `pay_TEST${String(++this.n).padStart(8, "0")}`,
      order_id: orderId,
      amount: order.amount,
      currency: order.currency,
      status: "captured",
      method: "upi",
      amount_refunded: 0,
      ...over,
    };
    this.payments.set(p.id, p);
    return p;
  }
}

let db: MemoryDb;
let clock: number;
let rzp: FakeRazorpay;
let signer: EntitlementSigner;
let app: ReturnType<typeof createApp>;

async function testSigner(): Promise<EntitlementSigner> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return createSigner("test-1", b64(pkcs8), b64(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
}

function makeApp(over: Partial<Deps> = {}) {
  return createApp({
    serviceDb: db,
    userDb: () => db,
    verifyUser: async (t) => USERS[t] ?? null,
    appOrigin: "https://app.aevrin.net",
    now: () => new Date(clock),
    billing: { keyId: "rzp_test_key", keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET, api: rzp },
    signer,
    ...over,
  });
}

beforeEach(async () => {
  db = new MemoryDb();
  clock = Date.parse("2026-10-02T10:00:00Z");
  rzp = new FakeRazorpay();
  signer ??= await testSigner();
  app = makeApp();
});

const call = (method: string, path: string, opts: { token?: string; body?: unknown; raw?: string; headers?: Record<string, string> } = {}) =>
  app.request(`/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });

const json = async (res: Response) => (await res.json()) as Record<string, any>;

async function checkout(token: string, interval: "month" | "year" = "month") {
  const res = await call("POST", "/billing/checkout", { token, body: { plan: "pro", interval } });
  expect(res.status).toBe(200);
  return json(res);
}

async function verify(token: string, orderId: string, payment: RzpPayment, signature?: string) {
  const sig = signature ?? (await hmacSha256Hex(KEY_SECRET, `${orderId}|${payment.id}`));
  return call("POST", "/billing/verify", {
    token,
    body: { razorpay_order_id: orderId, razorpay_payment_id: payment.id, razorpay_signature: sig },
  });
}

async function webhook(event: unknown, eventId = `evt_${Math.random().toString(36).slice(2)}`, secret = WEBHOOK_SECRET) {
  const raw = JSON.stringify(event);
  return call("POST", "/billing/webhook", {
    raw,
    headers: { "x-razorpay-signature": await hmacSha256Hex(secret, raw), "x-razorpay-event-id": eventId },
  });
}

const sub = async (token = "token-a") => json(await call("GET", "/subscription", { token }));

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
    const plans = (await json(await call("GET", "/plans"))) as unknown as any[];
    const pro = plans.find((p) => p.id === "pro");
    expect(pro.prices.month).toEqual({ amount: MONTH, currency: "INR" });
    expect(pro.prices.year.amount).toBe(YEAR);
    expect(pro.priceLabel).toContain("899");
    expect(plans.find((p) => p.id === "enterprise").priceLabel).toBe("Contact sales");
  });
});

describe("checkout and server-side confirmation (issue #12)", () => {
  it("answers 503 when billing is not configured", async () => {
    app = makeApp({ billing: undefined });
    const res = await call("POST", "/billing/checkout", { token: "token-a", body: { plan: "pro", interval: "month" } });
    expect(res.status).toBe(503);
  });

  it("creates an order for the configured price and never trusts the client for the amount", async () => {
    const bad = await call("POST", "/billing/checkout", { token: "token-a", body: { plan: "pro", interval: "month", amount: 1 } });
    expect(bad.status).toBe(422);
    const order = await checkout("token-a");
    expect(order).toMatchObject({ amount: MONTH, currency: "INR", keyId: "rzp_test_key", creditApplied: 0 });
    expect(JSON.stringify(order)).not.toContain(KEY_SECRET);
    expect(rzp.orders.get(order.orderId)!.amount).toBe(MONTH);
  });

  it("upgrades only after the signature AND Razorpay's record check out, exactly once", async () => {
    const order = await checkout("token-a");
    const payment = rzp.pay(order.orderId);

    const forged = await verify("token-a", order.orderId, payment, "0".repeat(64));
    expect(forged.status).toBe(400);
    expect(db.table("payments").rows[0].status).toBe("created");

    const ok = await json(await verify("token-a", order.orderId, payment));
    expect(ok.status).toBe("paid");
    expect(ok.subscription).toMatchObject({ planId: "pro", status: "active", interval: "month", source: "payment" });
    expect(ok.subscription.paidUntil).toBe("2026-11-02T10:00:00.000Z");

    // The browser retries and the webhook arrives too: still one month, one invoice.
    await verify("token-a", order.orderId, payment);
    await webhook({ event: "payment.captured", payload: { payment: { entity: payment } } });
    expect((await sub()).paidUntil).toBe("2026-11-02T10:00:00.000Z");
    const invoices = (await json(await call("GET", "/invoices", { token: "token-a" }))) as unknown as any[];
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ amount: 899, status: "paid", interval: "month" });
    expect(invoices[0].number).toMatch(/^AEV-2026-\d{6}$/);
  });

  it("refuses a payment whose amount does not match the order", async () => {
    const order = await checkout("token-a");
    const payment = rzp.pay(order.orderId, { amount: 100 });
    const res = await verify("token-a", order.orderId, payment);
    expect(res.status).toBe(400);
    expect((await sub()).planId).toBe("free");
  });

  it("will not confirm another account's order", async () => {
    const order = await checkout("token-a");
    const payment = rzp.pay(order.orderId);
    const res = await verify("token-b", order.orderId, payment);
    expect(res.status).toBe(404);
  });

  it("adds a renewal to the end date, and a year to a yearly purchase", async () => {
    const first = await checkout("token-a");
    await verify("token-a", first.orderId, rzp.pay(first.orderId));
    clock = Date.parse("2026-10-20T00:00:00Z");
    const second = await checkout("token-a", "year");
    expect(second.amount).toBe(YEAR);
    await verify("token-a", second.orderId, rzp.pay(second.orderId));
    const s = await sub();
    expect(s.paidUntil).toBe("2027-11-02T10:00:00.000Z");
    expect(s.interval).toBe("year");
  });

  it("lapses to Free when the paid period ends", async () => {
    const order = await checkout("token-a");
    await verify("token-a", order.orderId, rzp.pay(order.orderId));
    clock = Date.parse("2026-11-01T10:00:00Z");
    expect((await sub()).renewalDue).toBe(true);
    clock = Date.parse("2026-11-03T00:00:00Z");
    const s = await sub();
    expect(s).toMatchObject({ planId: "free", status: "expired", lapsedPlanId: "pro" });
  });

  it("applies account credit at checkout, and pays fully from credit when it covers the price", async () => {
    await db.rpc("adjust_credit", { p_owner: "user-a", p_delta: 50000, p_reason: "goodwill", p_actor: "admin:x@aevrin.net" });
    const order = await checkout("token-a");
    expect(order.amount).toBe(MONTH - 50000);
    expect(order.creditApplied).toBe(50000);
    await verify("token-a", order.orderId, rzp.pay(order.orderId));
    expect((await sub()).creditPaise).toBe(0);

    await db.rpc("adjust_credit", { p_owner: "user-a", p_delta: 100000, p_reason: "promo", p_actor: "admin:x@aevrin.net" });
    const res = await checkout("token-a");
    expect(res.paidWithCredit).toBe(true);
    expect(res.subscription.creditPaise).toBe(100000 - MONTH);
    expect(res.subscription.paidUntil).toBe("2026-12-02T10:00:00.000Z");
  });

  it("reconciles a paid order when neither the browser nor the webhook reported it", async () => {
    const order = await checkout("token-a");
    rzp.pay(order.orderId); // the tab closed after paying
    expect((await sub()).planId).toBe("pro");
  });
});

describe("webhooks (issue #12)", () => {
  it("rejects a bad signature and changes nothing", async () => {
    const order = await checkout("token-a");
    const payment = rzp.pay(order.orderId);
    const res = await webhook({ event: "order.paid", payload: { payment: { entity: payment } } }, "evt_1", "wrong-secret");
    expect(res.status).toBe(400);
    expect(db.table("payments").rows[0].status).toBe("created");
  });

  it("applies order.paid once, and skips a repeated event id", async () => {
    const order = await checkout("token-a");
    const payment = rzp.pay(order.orderId);
    const event = { event: "order.paid", payload: { payment: { entity: payment } } };
    expect((await json(await webhook(event, "evt_same"))).ok).toBe(true);
    expect((await json(await webhook(event, "evt_same"))).duplicate).toBe(true);
    expect(db.table("payments").rows[0].status).toBe("paid");
    expect((await sub()).paidUntil).toBe("2026-11-02T10:00:00.000Z");
  });

  it("takes back the time a fully refunded payment bought", async () => {
    const order = await checkout("token-a");
    const payment = rzp.pay(order.orderId);
    await verify("token-a", order.orderId, payment);
    await webhook({
      event: "refund.processed",
      payload: { refund: { entity: { payment_id: payment.id, amount: MONTH } }, payment: { entity: { ...payment, amount_refunded: MONTH } } },
    });
    expect(db.table("payments").rows[0].status).toBe("refunded");
    expect((await sub()).planId).toBe("free");
  });

  it("answers 503 when no webhook secret is set", async () => {
    app = makeApp({ billing: { keyId: "k", keySecret: KEY_SECRET, webhookSecret: "", api: rzp } });
    expect((await webhook({ event: "order.paid" })).status).toBe(503);
  });
});

describe("plan limits on the server", () => {
  async function linkDevice(token: string) {
    const code = await json(await call("POST", "/device/code", { body: { name: "laptop", os: "Linux", engine_version: "0.0.3" } }));
    const res = await call("POST", "/device/approve", { token, body: { user_code: code.user_code } });
    clock += 6000;
    if (res.status !== 200) return { status: res.status, body: await json(res) };
    const tok = await json(await call("POST", "/device/token", { body: { device_code: code.device_code } }));
    return { status: 200, token: tok.device_token as string };
  }

  it("allows one device on Free and ten on Pro", async () => {
    expect((await linkDevice("token-a")).status).toBe(200);
    const second = await linkDevice("token-a");
    expect(second.status).toBe(403);
    expect(second.body?.error).toBe("plan_limit");
    const order = await checkout("token-a");
    await verify("token-a", order.orderId, rzp.pay(order.orderId));
    expect((await linkDevice("token-a")).status).toBe(200);
  });

  it("caps active projects on Free", async () => {
    await call("GET", "/me", { token: "token-a" });
    for (const name of ["one", "two"]) {
      expect((await call("POST", "/projects", { token: "token-a", body: { name, description: "" } })).status).toBe(201);
    }
    const third = await call("POST", "/projects", { token: "token-a", body: { name: "three", description: "" } });
    expect(third.status).toBe(403);
  });

  it("keeps evidence and transcript sync for Pro", async () => {
    await call("GET", "/me", { token: "token-a" });
    const res = await call("PATCH", "/settings", { token: "token-a", body: { sync: { detailedEvidence: true } } });
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe("upgrade_required");
  });
});

describe("signed entitlements (issue #11)", () => {
  async function deviceToken(token = "token-a") {
    const code = await json(await call("POST", "/device/code", { body: { name: "laptop", os: "Linux", engine_version: "0.0.3" } }));
    await call("POST", "/device/approve", { token, body: { user_code: code.user_code } });
    clock += 6000;
    return (await json(await call("POST", "/device/token", { body: { device_code: code.device_code } }))).device_token as string;
  }

  it("publishes the public key", async () => {
    const keys = await json(await call("GET", "/entitlements/keys"));
    expect(keys.keys).toEqual([{ kid: "test-1", kty: "OKP", crv: "Ed25519", alg: "EdDSA", x: signer.publicKey }]);
  });

  it("signs a Free entitlement on heartbeat that the public key verifies", async () => {
    const dt = await deviceToken();
    const hb = await json(await call("POST", "/device/heartbeat", { token: dt, body: { engine_version: "0.0.3" } }));
    expect(hb.plan).toBe("free");
    const payload = await verifyToken(hb.entitlement, signer.publicKey);
    expect(payload).toMatchObject({ v: 1, sub: "user-a", plan: "free", features: { advanced_strategies: false, mcp: false } });
    expect(payload!.limits.campaigns).toBe(20);
    expect(payload!.exp - payload!.iat).toBe(7 * 24 * 3600);
  });

  it("rejects a token whose payload was edited", async () => {
    const dt = await deviceToken();
    const { entitlement } = await json(await call("GET", "/device/entitlement", { token: dt }));
    const [h, p, s] = String(entitlement).split(".");
    const claims = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    claims.plan = "enterprise";
    const forged = `${h}.${btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${s}`;
    expect(await verifyToken(forged, signer.publicKey)).toBeNull();
  });

  it("issues Pro after payment, never past the paid-until date, plus any bonus", async () => {
    const dt = await deviceToken();
    const order = await checkout("token-a");
    await verify("token-a", order.orderId, rzp.pay(order.orderId));
    await db.table("subscriptions").update({ owner_id: "user-a" }, { bonus: { attacks: 500 } });
    clock = Date.parse("2026-10-30T10:00:00Z");
    const { entitlement } = await json(await call("GET", "/device/entitlement", { token: dt }));
    const payload = (await verifyToken(entitlement, signer.publicKey))!;
    expect(payload.plan).toBe("pro");
    expect(payload.features.advanced_strategies).toBe(true);
    expect(payload.limits.attacks).toBe(100000 + 500);
    expect(payload.exp).toBe(Date.parse((await sub()).paidUntil) / 1000);
  });

  it("gives no entitlement when signing is not configured", async () => {
    app = makeApp({ signer: undefined });
    const dt = await deviceToken();
    const hb = await json(await call("POST", "/device/heartbeat", { token: dt, body: {} }));
    expect(hb.entitlement).toBeUndefined();
    expect((await call("GET", "/device/entitlement", { token: dt })).status).toBe(503);
  });
});
