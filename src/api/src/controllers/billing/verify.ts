import type { AppContext } from "../../types/appEnv";
import { confirmPayment } from "../../services/billing/confirmPayment";
import { gatewayError, requireBilling } from "../../services/billing/gateway";
import { subscriptionView } from "../../services/billing/views";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import type { KeyLimit } from "../../middleware/rateLimit";
import { verifyCheckoutSignature, type BillingConfig, type RzpPayment } from "../../services/razorpay/client";
import { VerifyPaymentReq } from "../../validators/schemas";

async function fetchPayment(billing: BillingConfig, paymentId: string): Promise<RzpPayment> {
  try {
    return await billing.api.fetchPayment(paymentId);
  } catch (err) {
    gatewayError(err);
  }
}

// success needs both Checkout's signature AND Razorpay's own record of a captured payment for this order
export async function verifyPayment(c: AppContext, deps: Deps, limit: KeyLimit): Promise<Response> {
  const billing = requireBilling(deps);
  const user = c.get("user");
  limit(`verify:${user.id}`, 20, 60_000);
  const body = await parseBody(c, VerifyPaymentReq);
  const [order] = await deps.serviceDb
    .table("payments")
    .select({ eq: { razorpay_order_id: body.razorpay_order_id, owner_id: user.id } });
  if (!order) throw new ApiError(404, "unknown_order", "That order was not found.");
  const isSigned = await verifyCheckoutSignature(billing.keySecret, body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature);
  if (!isSigned) throw new ApiError(400, "invalid_signature", "The payment could not be verified.");
  const payment = await fetchPayment(billing, body.razorpay_payment_id);
  const result = await confirmPayment(deps, billing, order, payment);
  if (result === "mismatch") throw new ApiError(400, "payment_mismatch", "The payment does not match this order.");
  return c.json({ status: result, subscription: await subscriptionView(deps, c.get("db"), user.id) });
}
