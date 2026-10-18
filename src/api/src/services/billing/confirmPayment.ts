import type { Deps, Row } from "../../types/deps";
import { log } from "../../lib/log";
import type { BillingConfig, RzpPayment } from "../razorpay/client";
import { str } from "../../lib/strings";
import { gatewayError } from "./gateway";
import { paymentsRepository } from "../../repositories/payments";

export type ConfirmResult = "paid" | "pending" | "failed" | "mismatch";

function matchesOrder(payment: RzpPayment, order: Row): boolean {
  return (
    payment.order_id === order.razorpay_order_id &&
    payment.amount === Number(order.amount_paise) &&
    payment.currency === order.currency
  );
}

async function captureIfAuthorized(billing: BillingConfig, payment: RzpPayment): Promise<RzpPayment> {
  if (payment.status !== "authorized") return payment;
  try {
    return await billing.api.capturePayment(payment.id, payment.amount, payment.currency);
  } catch (err) {
    gatewayError(err);
  }
}

// fulfil_payment applies a payment exactly once, however many times it is called
async function fulfil(deps: Deps, order: Row, payment: RzpPayment): Promise<ConfirmResult> {
  const payments = paymentsRepository(deps.serviceDb);
  const method = payment.method ?? "razorpay";
  const result = (await payments.fulfil(str(order.razorpay_order_id), payment.id, method, deps.now().toISOString())) as { ok: boolean };
  if (!result.ok) return "mismatch";
  if (payment.status === "refunded" || (payment.amount_refunded ?? 0) > 0) {
    await payments.recordRefund(payment.id, payment.amount_refunded ?? payment.amount, deps.now().toISOString());
  }
  return "paid";
}

/** Apply what Razorpay says about one payment to our order row. Safe to call any number of times. */
export async function confirmPayment(deps: Deps, billing: BillingConfig, order: Row, payment: RzpPayment): Promise<ConfirmResult> {
  if (!matchesOrder(payment, order)) {
    log.error("payment_order_mismatch", { orderId: str(order.id) });
    return "mismatch";
  }
  const current = await captureIfAuthorized(billing, payment);
  if (current.status === "captured" || current.status === "refunded") return fulfil(deps, order, current);
  if (current.status === "failed") {
    await paymentsRepository(deps.serviceDb).markFailed(str(order.id));
    return "failed";
  }
  return "pending";
}
