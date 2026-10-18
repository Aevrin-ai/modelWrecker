import type { AppContext } from "../../types/appEnv";
import { confirmPayment } from "../../services/billing/confirmPayment";
import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { log } from "../../lib/log";
import { clientIp, type KeyLimit } from "../../middleware/rateLimit";
import { verifyWebhookSignature, type BillingConfig, type RzpPayment } from "../../services/razorpay/client";
import { str } from "../../lib/strings";

const MAX_WEBHOOK_BYTES = 512 * 1024;
const PAYMENT_EVENTS = ["payment.captured", "payment.authorized", "order.paid", "payment.failed"];

interface WebhookEvent {
  event?: string;
  payload?: Record<string, { entity?: Record<string, unknown> }>;
}

function parseEvent(raw: string): WebhookEvent {
  try {
    return JSON.parse(raw) as WebhookEvent;
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON.");
  }
}

async function readSignedBody(c: AppContext, billing: BillingConfig): Promise<string> {
  const raw = await c.req.text();
  if (raw.length > MAX_WEBHOOK_BYTES) throw new ApiError(413, "payload_too_large", "Request body is too large.");
  const signature = c.req.header("x-razorpay-signature") ?? "";
  if (!signature || !(await verifyWebhookSignature(billing.webhookSecret, raw, signature))) {
    log.warn("payment_webhook_signature_rejected");
    throw new ApiError(400, "invalid_signature", "Signature check failed.");
  }
  return raw;
}

async function applyEvent(deps: Deps, billing: BillingConfig, name: string, event: WebhookEvent): Promise<void> {
  const payment = event.payload?.payment?.entity as RzpPayment | undefined;
  if (payment && PAYMENT_EVENTS.includes(name)) {
    const [order] = await deps.serviceDb.table("payments").select({ eq: { razorpay_order_id: str(payment.order_id) } });
    if (order) await confirmPayment(deps, billing, order, payment);
    return;
  }
  if (name !== "refund.processed" && name !== "payment.refunded") return;
  const refund = event.payload?.refund?.entity as { payment_id?: string; amount?: number } | undefined;
  const paymentId = str(payment?.id ?? refund?.payment_id);
  const refunded = Number(payment?.amount_refunded ?? refund?.amount ?? 0);
  if (paymentId && refunded > 0) {
    await deps.serviceDb.rpc("refund_payment", { p_payment_id: paymentId, p_amount_refunded: refunded, p_now: deps.now().toISOString() });
  }
}

// Razorpay calls this with no user session: the HMAC over the raw body is the authentication
export async function billingWebhook(c: AppContext, deps: Deps, limit: KeyLimit): Promise<Response> {
  const billing = deps.billing;
  if (!billing?.webhookSecret) throw new ApiError(503, "billing_unavailable", "Webhooks are not configured.");
  limit(`webhook:${clientIp(c)}`, 300, 60_000);
  const event = parseEvent(await readSignedBody(c, billing));
  const eventId = c.req.header("x-razorpay-event-id") ?? "";
  const events = deps.serviceDb.table("billing_events");
  if (eventId && (await events.count({ eq: { event_id: eventId } })) > 0) return c.json({ ok: true, duplicate: true });

  const name = str(event.event);
  await applyEvent(deps, billing, name, event);
  // recording the id only skips repeats; a failed insert must not fail an event that was already applied
  if (eventId) await events.insert({ event_id: eventId.slice(0, 120), event: name.slice(0, 60) }).catch(() => undefined);
  return c.json({ ok: true });
}
