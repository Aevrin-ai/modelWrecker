import type { Deps, Row } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { str } from "../../lib/strings";
import { gatewayError, requireBilling } from "./gateway";

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
