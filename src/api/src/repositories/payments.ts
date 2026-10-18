import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

const NEWEST_FIRST = { column: "created_at", ascending: false };
const INVOICE_STATUSES = ["paid", "refunded", "partially_refunded"];

interface PaymentPage {
  status?: string;
  limit: number;
  offset: number;
}

export function paymentsRepository(db: Database) {
  const payments = db.table("payments");
  return namedQueries("payments", {
    insert: (row: Row): Promise<Row> => payments.insert(row),
    findByOrderId: (orderId: string): Promise<Row | null> => firstRow(payments.select({ eq: { razorpay_order_id: orderId } })),
    findByOrderIdForOwner: (orderId: string, owner: string): Promise<Row | null> =>
      firstRow(payments.select({ eq: { razorpay_order_id: orderId, owner_id: owner } })),
    findForOwner: (id: string, owner: string): Promise<Row | null> => firstRow(payments.select({ eq: { id, owner_id: owner } })),
    findNewestForOwner: (owner: string): Promise<Row | null> =>
      firstRow(payments.select({ eq: { owner_id: owner }, order: NEWEST_FIRST, limit: 1 })),
    listNewestFirst: ({ status, limit, offset }: PaymentPage): Promise<Row[]> =>
      payments.select({ ...(status ? { eq: { status } } : {}), order: NEWEST_FIRST, limit, offset }),
    listNewestForOwner: (owner: string, limit: number): Promise<Row[]> =>
      payments.select({ eq: { owner_id: owner }, order: NEWEST_FIRST, limit }),
    listInvoicesForOwner: (owner: string, limit: number): Promise<Row[]> =>
      payments.select({
        eq: { owner_id: owner },
        in: { column: "status", values: INVOICE_STATUSES },
        order: { column: "paid_at", ascending: false },
        limit,
      }),
    // unpaid orders since a time, newest first, for reconciliation with Razorpay
    listOpenSinceForOwner: (owner: string, since: string, limit: number): Promise<Row[]> =>
      payments.select({ eq: { owner_id: owner, status: "created" }, gte: { created_at: since }, order: NEWEST_FIRST, limit }),
    // only an order that is still open can fail, so a paid order is never overwritten
    markFailed: (id: string): Promise<Row[]> =>
      payments.update({ id, status: "created" }, { status: "failed", razorpay_payment_id: null }),
    keepEmailForOwner: (owner: string, email: string): Promise<Row[]> => payments.update({ owner_id: owner }, { customer_email: email }),
    // fulfil_payment applies a payment exactly once, however many times it is called
    fulfil: (orderId: string, paymentId: string | null, method: string, now: string): Promise<unknown> =>
      db.rpc("fulfil_payment", { p_order_id: orderId, p_payment_id: paymentId, p_method: method, p_now: now }),
    recordRefund: (paymentId: string, amountRefunded: number, now: string): Promise<unknown> =>
      db.rpc("refund_payment", { p_payment_id: paymentId, p_amount_refunded: amountRefunded, p_now: now }),
  });
}
