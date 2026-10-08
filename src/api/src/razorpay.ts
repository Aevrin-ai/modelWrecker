// Razorpay, server side only (issue #12, docs/billing/razorpay.md). The key secret and the webhook secret
// are Worker secrets; neither ever reaches the browser, the engine, the CLI, or a log line. Only the key
// id (public by design, Checkout needs it) is sent to the browser.

/** The parts of a Razorpay payment entity this API relies on. */
export interface RzpPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  method?: string;
  amount_refunded?: number;
  email?: string;
}

export interface RzpOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** The Razorpay calls billing needs. Tests pass a fake; production uses HttpRazorpay. */
export interface RazorpayApi {
  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<RzpOrder>;
  fetchPayment(paymentId: string): Promise<RzpPayment>;
  capturePayment(paymentId: string, amount: number, currency: string): Promise<RzpPayment>;
  orderPayments(orderId: string): Promise<RzpPayment[]>;
  refund(paymentId: string, notes: Record<string, string>): Promise<{ id: string; status: string; amount: number }>;
}

export interface BillingConfig {
  keyId: string;
  keySecret: string;
  /** Set when the webhook is configured in the Razorpay dashboard. Webhooks are refused without it. */
  webhookSecret: string;
  api: RazorpayApi;
}

/** A Razorpay call failed. The message is for server logs only, and never includes a secret. */
export class RazorpayError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`razorpay ${status} ${code}`);
  }
}

const BASE = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 15_000;

export class HttpRazorpay implements RazorpayApi {
  private auth: string;

  constructor(keyId: string, keySecret: string) {
    this.auth = `Basic ${btoa(`${keyId}:${keySecret}`)}`;
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers: { Authorization: this.auth, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw new RazorpayError(0, "network_error");
    } finally {
      clearTimeout(timer);
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (data.error ?? {}) as Record<string, unknown>;
      throw new RazorpayError(res.status, String(err.code ?? "error").slice(0, 64));
    }
    return data as T;
  }

  createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
    // Automatic capture, so an authorized payment becomes money received without a second call.
    return this.call<RzpOrder>("POST", "/orders", { ...input, payment: { capture: "automatic" } });
  }

  fetchPayment(paymentId: string) {
    return this.call<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);
  }

  capturePayment(paymentId: string, amount: number, currency: string) {
    return this.call<RzpPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency });
  }

  async orderPayments(orderId: string) {
    const data = await this.call<{ items?: RzpPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`);
    return data.items ?? [];
  }

  refund(paymentId: string, notes: Record<string, string>) {
    return this.call<{ id: string; status: string; amount: number }>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
      notes,
    });
  }
}

const enc = new TextEncoder();

/** Hex HMAC-SHA256 of `message` keyed with `secret`. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compare two strings in time that does not depend on where they differ. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checkout's success signature: HMAC-SHA256(order_id + "|" + payment_id) with the key secret. */
export async function verifyCheckoutSignature(keySecret: string, orderId: string, paymentId: string, signature: string) {
  const expected = await hmacSha256Hex(keySecret, `${orderId}|${paymentId}`);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}

/** A webhook's signature: HMAC-SHA256 of the raw body with the webhook secret. */
export async function verifyWebhookSignature(webhookSecret: string, rawBody: string, signature: string) {
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  return timingSafeEqual(expected, signature.trim().toLowerCase());
}
