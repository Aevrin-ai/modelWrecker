import type { Deps } from "../../types/deps";
import { errorFields, log } from "../../lib/log";
import { str } from "../../lib/strings";
import { confirmPayment } from "./confirmPayment";

const RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
      const best = payments.find((payment) => payment.status === "captured") ?? payments.find((payment) => payment.status === "authorized");
      if (best) await confirmPayment(deps, deps.billing, order, best);
    } catch (err) {
      // reconciliation is a backstop; a failure here must never break the Billing page
      log.warn("payment_reconcile_failed", { orderId: str(order.id), ...errorFields(err) });
    }
  }
}
