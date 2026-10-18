// the app with a fake Razorpay and a real Ed25519 signer, for the billing and entitlement tests
import { expect } from "vitest";
import { createApp } from "../src/app";
import type { AuthUser, Deps } from "../src/types/deps";
import { MemoryDb } from "../src/database/memory";
import { createSigner, type EntitlementSigner } from "../src/services/entitlements/signing";
import { hmacSha256Hex, type RazorpayApi, type RzpPayment } from "../src/services/razorpay/client";
import { callApi, readJson, type CallOptions, type TestApp } from "./harness";

export const USERS: Record<string, AuthUser> = {
  "token-a": { id: "user-a", email: "a@example.com", name: "Alice" },
  "token-b": { id: "user-b", email: "b@example.com", name: "Bob" },
};
export const KEY_SECRET = "test_key_secret_value";
export const WEBHOOK_SECRET = "test_webhook_secret_value";
export const MONTH = 89900;
export const YEAR = 989900;

/** Razorpay in memory. `pay(orderId)` plays the customer completing Checkout. */
export class FakeRazorpay implements RazorpayApi {
  orders = new Map<string, { id: string; amount: number; currency: string; status: string }>();
  payments = new Map<string, RzpPayment>();
  refunds: string[] = [];
  private idCount = 0;

  private nextId(prefix: string): string {
    this.idCount += 1;
    return `${prefix}${String(this.idCount).padStart(8, "0")}`;
  }

  async createOrder(input: { amount: number; currency: string }) {
    const order = { id: this.nextId("order_TEST"), amount: input.amount, currency: input.currency, status: "created" };
    this.orders.set(order.id, order);
    return { ...order };
  }
  async fetchPayment(id: string) {
    const payment = this.payments.get(id);
    if (!payment) throw new Error("no such payment");
    return { ...payment };
  }
  async capturePayment(id: string) {
    const payment = this.payments.get(id)!;
    payment.status = "captured";
    return { ...payment };
  }
  async orderPayments(orderId: string) {
    return [...this.payments.values()].filter((payment) => payment.order_id === orderId).map((payment) => ({ ...payment }));
  }
  async refund(id: string) {
    const payment = this.payments.get(id)!;
    payment.status = "refunded";
    payment.amount_refunded = payment.amount;
    this.refunds.push(id);
    return { id: `rfnd_TEST${this.refunds.length}`, status: "processed", amount: payment.amount };
  }
  pay(orderId: string, over: Partial<RzpPayment> = {}): RzpPayment {
    const order = this.orders.get(orderId)!;
    const id = this.nextId("pay_TEST");
    const payment: RzpPayment = { id, order_id: orderId, amount: order.amount, currency: order.currency, status: "captured", method: "upi", amount_refunded: 0, ...over };
    this.payments.set(payment.id, payment);
    return payment;
  }
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const toBase64Url = (bytes: Uint8Array) => toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function testSigner(): Promise<EntitlementSigner> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  return createSigner("test-1", toBase64(pkcs8), toBase64Url(raw));
}

/** What a checkout answers: an order to pay, or a purchase paid entirely with credit. */
export interface CheckoutBody {
  orderId: string;
  amount: number;
  creditApplied: number;
  paidWithCredit?: boolean;
  subscription: SubscriptionBody;
}

export interface SubscriptionBody {
  planId: string;
  paidUntil: string;
  interval: string;
  creditPaise: number;
  renewalDue: boolean;
}

export class BillingHarness {
  db = new MemoryDb();
  clock = Date.parse("2026-10-02T10:00:00Z");
  rzp = new FakeRazorpay();
  app: TestApp;

  constructor(public signer: EntitlementSigner) {
    this.app = this.makeApp();
  }

  makeApp(over: Partial<Deps> = {}): TestApp {
    return createApp({
      serviceDb: this.db,
      userDb: () => this.db,
      verifyUser: async (token) => USERS[token] ?? null,
      appOrigin: "https://app.aevrin.net",
      now: () => new Date(this.clock),
      billing: { keyId: "rzp_test_key", keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET, api: this.rzp },
      signer: this.signer,
      ...over,
    });
  }

  call(method: string, path: string, opts: CallOptions = {}): Promise<Response> {
    return callApi(this.app, method, path, opts);
  }

  async callJson<T = Record<string, unknown>>(method: string, path: string, opts: CallOptions = {}): Promise<T> {
    return readJson<T>(await this.call(method, path, opts));
  }

  async checkout(token: string, interval: "month" | "year" = "month"): Promise<CheckoutBody> {
    const res = await this.call("POST", "/billing/checkout", { token, body: { plan: "pro", interval } });
    expect(res.status).toBe(200);
    return readJson<CheckoutBody>(res);
  }

  async verify(token: string, orderId: string, payment: RzpPayment, signature?: string): Promise<Response> {
    const checkoutSignature = signature ?? (await hmacSha256Hex(KEY_SECRET, `${orderId}|${payment.id}`));
    return this.call("POST", "/billing/verify", {
      token,
      body: { razorpay_order_id: orderId, razorpay_payment_id: payment.id, razorpay_signature: checkoutSignature },
    });
  }

  async webhook(event: unknown, eventId = `evt_${Math.random().toString(36).slice(2)}`, secret = WEBHOOK_SECRET): Promise<Response> {
    const raw = JSON.stringify(event);
    return this.call("POST", "/billing/webhook", {
      raw,
      headers: { "x-razorpay-signature": await hmacSha256Hex(secret, raw), "x-razorpay-event-id": eventId },
    });
  }

  subscription(token = "token-a"): Promise<SubscriptionBody> {
    return this.callJson<SubscriptionBody>("GET", "/subscription", { token });
  }

  /** Link a device through the full sign-in, and return the status of the approval and the device token. */
  async linkDevice(token: string): Promise<{ status: number; token?: string; error?: string }> {
    const code = await this.callJson<{ user_code: string; device_code: string }>("POST", "/device/code", {
      body: { name: "laptop", os: "Linux", engine_version: "0.0.3" },
    });
    const res = await this.call("POST", "/device/approve", { token, body: { user_code: code.user_code } });
    this.clock += 6000;
    if (res.status !== 200) return { status: res.status, error: (await readJson<{ error: string }>(res)).error };
    const issued = await this.callJson<{ device_token: string }>("POST", "/device/token", { body: { device_code: code.device_code } });
    return { status: 200, token: issued.device_token };
  }
}
