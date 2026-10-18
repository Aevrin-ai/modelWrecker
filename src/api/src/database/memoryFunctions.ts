// JavaScript mirrors of the Postgres functions in deploy/supabase/migrations; keep them in step with the SQL
import type { Row } from "../types/deps";
import type { MemoryDb } from "./memory";

/** A JavaScript stand-in for one Postgres function, for offline tests. */
export type MemoryFn = (db: MemoryDb, args: Record<string, unknown>) => unknown;

let idCount = 0;

/** A predictable UUID-shaped id, unique within the test process. */
export function memoryId(): string {
  idCount += 1;
  return `00000000-0000-4000-8000-${String(idCount).padStart(12, "0")}`;
}

// "2026-01-31" plus one month -> "2026-02-28": the day is clamped to the end of a shorter month
function addMonthsIso(iso: string, months: number): string {
  const date = new Date(iso);
  const dayOfMonth = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(dayOfMonth, lastDay));
  return date.toISOString();
}

function ensureSubscription(db: MemoryDb, owner: unknown): Row {
  const subscriptions = db.table("subscriptions");
  let subscription = subscriptions.rows.find((row) => row.owner_id === owner);
  if (!subscription) {
    subscription = { id: memoryId(), owner_id: owner, plan: "free", status: "active", source: "free", credit_paise: 0, bonus: {} };
    subscriptions.rows.push(subscription);
  }
  return subscription;
}

function addLedgerEntry(db: MemoryDb, row: Row): void {
  db.table("credit_ledger").rows.push({ id: memoryId(), created_at: new Date().toISOString(), ...row });
}

// a renewal of the same live plan adds to its end date; anything else starts now
function periodStartFor(subscription: Row, payment: Row, now: string): string {
  const end = subscription.current_period_end ? String(subscription.current_period_end) : null;
  const isRenewal = subscription.plan === payment.plan && subscription.status !== "canceled" && end && end > now;
  return isRenewal && end ? end : now;
}

function recordCreditUsed(db: MemoryDb, payment: Row, balance: number, invoiceNumber: string): void {
  const creditUsed = Number(payment.credit_applied_paise);
  if (creditUsed > 0) {
    addLedgerEntry(db, {
      owner_id: payment.owner_id,
      delta_paise: -creditUsed,
      balance_paise: balance,
      reason: `Applied to invoice ${invoiceNumber}`,
      actor: "checkout",
    });
  }
}

function fulfilPayment(db: MemoryDb, args: Record<string, unknown>): unknown {
  const payment = db.table("payments").rows.find((row) => row.razorpay_order_id === args.p_order_id);
  if (!payment) return { ok: false, reason: "unknown_order" };
  if (payment.status === "paid") return { ok: true, already: true, payment: payment.id, owner: payment.owner_id };
  if (payment.status !== "created" && payment.status !== "failed") return { ok: false, reason: `status_${payment.status}` };
  const now = String(args.p_now);
  const subscription = ensureSubscription(db, payment.owner_id);
  const start = periodStartFor(subscription, payment, now);
  const end = addMonthsIso(start, Number(payment.months));
  db.invoiceSeq += 1;
  const invoiceNumber = `AEV-${now.slice(0, 4)}-${String(db.invoiceSeq).padStart(6, "0")}`;
  Object.assign(payment, {
    status: "paid",
    razorpay_payment_id: args.p_payment_id ?? payment.razorpay_payment_id ?? null,
    method: args.p_method,
    paid_at: now,
    period_start: start,
    period_end: end,
    invoice_number: invoiceNumber,
  });
  const credit = Math.max(0, Number(subscription.credit_paise ?? 0) - Number(payment.credit_applied_paise));
  Object.assign(subscription, {
    plan: payment.plan,
    status: "active",
    source: "payment",
    billing_interval: payment.billing_interval,
    period_start: start === now ? now : (subscription.period_start ?? now),
    current_period_end: end,
    credit_paise: credit,
  });
  recordCreditUsed(db, payment, credit, invoiceNumber);
  return { ok: true, already: false, payment: payment.id, owner: payment.owner_id, period_end: end, invoice_number: invoiceNumber };
}

// a full refund takes back the time the payment bought and returns any credit it used
function takeBackRefundedTime(db: MemoryDb, payment: Row, now: string): void {
  const subscription = db.table("subscriptions").rows.find((row) => row.owner_id === payment.owner_id);
  if (!subscription || subscription.plan !== payment.plan || !subscription.current_period_end) return;
  const back = addMonthsIso(String(subscription.current_period_end), -Number(payment.months));
  subscription.current_period_end = back > now ? back : now;
  const creditUsed = Number(payment.credit_applied_paise);
  subscription.credit_paise = Number(subscription.credit_paise ?? 0) + creditUsed;
  if (creditUsed > 0) {
    addLedgerEntry(db, {
      owner_id: payment.owner_id,
      delta_paise: creditUsed,
      balance_paise: subscription.credit_paise,
      reason: `Returned with refund of invoice ${String(payment.invoice_number ?? payment.razorpay_order_id)}`,
      actor: "refund",
    });
  }
}

function refundPayment(db: MemoryDb, args: Record<string, unknown>): unknown {
  const payment = db.table("payments").rows.find((row) => row.razorpay_payment_id === args.p_payment_id);
  if (!payment) return { ok: false, reason: "unknown_payment" };
  if (payment.status === "refunded") return { ok: true, already: true, owner: payment.owner_id };
  if (payment.status !== "paid" && payment.status !== "partially_refunded") return { ok: false, reason: `status_${payment.status}` };
  const isFull = Number(args.p_amount_refunded) >= Number(payment.amount_paise);
  payment.amount_refunded_paise = Math.max(Number(payment.amount_refunded_paise ?? 0), Number(args.p_amount_refunded));
  payment.status = isFull ? "refunded" : "partially_refunded";
  if (isFull) takeBackRefundedTime(db, payment, String(args.p_now));
  return { ok: true, already: false, owner: payment.owner_id, full: isFull };
}

function adjustCredit(db: MemoryDb, args: Record<string, unknown>): unknown {
  const subscription = ensureSubscription(db, args.p_owner);
  const balance = Number(subscription.credit_paise ?? 0);
  const applied = Math.max(Number(args.p_delta), -balance);
  subscription.credit_paise = balance + applied;
  addLedgerEntry(db, { owner_id: args.p_owner, delta_paise: applied, balance_paise: balance + applied, reason: args.p_reason, actor: args.p_actor });
  return balance + applied;
}

export const FUNCTIONS: Record<string, MemoryFn> = {
  fulfil_payment: fulfilPayment,
  refund_payment: refundPayment,
  adjust_credit: adjustCredit,
};
