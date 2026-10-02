// In-memory Db for offline tests. Implements the same contract as the Supabase adapter, including
// unique-key upserts, so route behavior can be tested without a database.
import type { Db, Query, Row, Table } from "../db";

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

class MemoryTable implements Table {
  rows: Row[] = [];

  constructor(private uniques: string[][]) {}

  private matches(row: Row, eq: Record<string, unknown> = {}): boolean {
    return Object.entries(eq).every(([k, v]) => (row[k] ?? null) === v);
  }

  private checkUnique(row: Row, ignore?: Row): void {
    for (const cols of this.uniques) {
      if (cols.some((c) => row[c] == null)) continue; // NULLs never conflict, as in Postgres
      const clash = this.rows.find((r) => r !== ignore && cols.every((c) => r[c] === row[c]));
      if (clash) throw new Error(`duplicate key on ${cols.join(",")}`);
    }
  }

  private filter(q: Query): Row[] {
    let out = this.rows.filter((r) => this.matches(r, q.eq));
    if (q.ilike) {
      const needle = q.ilike.value.toLowerCase();
      out = out.filter((r) => String(r[q.ilike!.column] ?? "").toLowerCase().includes(needle));
    }
    if (q.in) {
      const { column, values } = q.in;
      out = out.filter((r) => values.includes(r[column]));
    }
    for (const [k, v] of Object.entries(q.gte ?? {})) out = out.filter((r) => r[k] != null && String(r[k]) >= String(v));
    for (const [k, v] of Object.entries(q.lt ?? {})) out = out.filter((r) => r[k] != null && String(r[k]) < String(v));
    return out;
  }

  async select(q: Query = {}): Promise<Row[]> {
    let out = this.filter(q);
    if (q.order) {
      const { column, ascending = true } = q.order;
      out = [...out].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
    }
    if (q.offset) out = out.slice(q.offset);
    if (q.limit) out = out.slice(0, q.limit);
    return out.map((r) => ({ ...r }));
  }

  async count(q: Query = {}): Promise<number> {
    return this.filter(q).length;
  }

  async insert(row: Row): Promise<Row> {
    const full = { id: uuid(), created_at: new Date().toISOString(), ...row };
    this.checkUnique(full);
    this.rows.push(full);
    return { ...full };
  }

  async update(eq: Record<string, unknown>, patch: Row): Promise<Row[]> {
    const hit = this.rows.filter((r) => this.matches(r, eq));
    for (const r of hit) {
      this.checkUnique({ ...r, ...patch }, r);
      Object.assign(r, patch);
    }
    return hit.map((r) => ({ ...r }));
  }

  async delete(eq: Record<string, unknown>): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !this.matches(r, eq));
    return before - this.rows.length;
  }

  async upsert(row: Row, onConflict: string[]): Promise<Row> {
    const existing = this.rows.find((r) => onConflict.every((c) => r[c] === row[c]));
    if (existing) {
      Object.assign(existing, row);
      return { ...existing };
    }
    return this.insert(row);
  }
}

// The unique keys from deploy/supabase/migrations, mirrored so tests catch duplicate-row bugs.
const UNIQUES: Record<string, string[][]> = {
  devices: [["credential_hash"]],
  device_auth_requests: [["device_code_hash"], ["user_code"]],
  campaigns: [["owner_id", "project_id", "external_id"]],
  runs: [["owner_id", "external_id"]],
  findings: [["owner_id", "external_id"]],
  targets: [["owner_id", "project_id", "name"]],
  subscriptions: [["owner_id"]],
  finding_evidence: [["finding_id"]],
  run_transcripts: [["run_id"]],
  payments: [["razorpay_order_id"], ["razorpay_payment_id"], ["invoice_number"]],
  billing_events: [["event_id"]],
  admin_mfa: [["user_id"]],
  admin_sessions: [["token_hash"]],
};

/** A JavaScript stand-in for one Postgres function, for offline tests. */
export type MemoryFn = (db: MemoryDb, args: Record<string, unknown>) => unknown;

const addMonthsIso = (iso: string, months: number) => {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
};

function ensureSub(db: MemoryDb, owner: unknown): Row {
  const subs = db.table("subscriptions");
  let sub = subs.rows.find((r) => r.owner_id === owner);
  if (!sub) {
    sub = { id: uuid(), owner_id: owner, plan: "free", status: "active", source: "free", credit_paise: 0, bonus: {} };
    subs.rows.push(sub);
  }
  return sub;
}

function ledger(db: MemoryDb, row: Row) {
  db.table("credit_ledger").rows.push({ id: uuid(), created_at: new Date().toISOString(), ...row });
}

// Mirrors of the functions in deploy/supabase/migrations. Keep them in step with the SQL.
const FUNCTIONS: Record<string, MemoryFn> = {
  fulfil_payment(db, a) {
    const pay = db.table("payments").rows.find((r) => r.razorpay_order_id === a.p_order_id);
    if (!pay) return { ok: false, reason: "unknown_order" };
    if (pay.status === "paid") return { ok: true, already: true, payment: pay.id, owner: pay.owner_id };
    if (pay.status !== "created" && pay.status !== "failed") return { ok: false, reason: `status_${pay.status}` };
    const now = String(a.p_now);
    const sub = ensureSub(db, pay.owner_id);
    const end = sub.current_period_end ? String(sub.current_period_end) : null;
    const base = sub.plan === pay.plan && sub.status !== "canceled" && end && end > now ? end : now;
    const fin = addMonthsIso(base, Number(pay.months));
    db.invoiceSeq += 1;
    const inv = `AEV-${now.slice(0, 4)}-${String(db.invoiceSeq).padStart(6, "0")}`;
    Object.assign(pay, {
      status: "paid",
      razorpay_payment_id: a.p_payment_id ?? pay.razorpay_payment_id ?? null,
      method: a.p_method,
      paid_at: now,
      period_start: base,
      period_end: fin,
      invoice_number: inv,
    });
    const credit = Math.max(0, Number(sub.credit_paise ?? 0) - Number(pay.credit_applied_paise));
    Object.assign(sub, {
      plan: pay.plan,
      status: "active",
      source: "payment",
      billing_interval: pay.billing_interval,
      period_start: base === now ? now : (sub.period_start ?? now),
      current_period_end: fin,
      credit_paise: credit,
    });
    if (Number(pay.credit_applied_paise) > 0) {
      ledger(db, {
        owner_id: pay.owner_id,
        delta_paise: -Number(pay.credit_applied_paise),
        balance_paise: credit,
        reason: `Applied to invoice ${inv}`,
        actor: "checkout",
      });
    }
    return { ok: true, already: false, payment: pay.id, owner: pay.owner_id, period_end: fin, invoice_number: inv };
  },
  refund_payment(db, a) {
    const pay = db.table("payments").rows.find((r) => r.razorpay_payment_id === a.p_payment_id);
    if (!pay) return { ok: false, reason: "unknown_payment" };
    if (pay.status === "refunded") return { ok: true, already: true, owner: pay.owner_id };
    if (pay.status !== "paid" && pay.status !== "partially_refunded") return { ok: false, reason: `status_${pay.status}` };
    const full = Number(a.p_amount_refunded) >= Number(pay.amount_paise);
    pay.amount_refunded_paise = Math.max(Number(pay.amount_refunded_paise ?? 0), Number(a.p_amount_refunded));
    pay.status = full ? "refunded" : "partially_refunded";
    if (full) {
      const sub = db.table("subscriptions").rows.find((r) => r.owner_id === pay.owner_id);
      if (sub && sub.plan === pay.plan && sub.current_period_end) {
        const back = addMonthsIso(String(sub.current_period_end), -Number(pay.months));
        const now = String(a.p_now);
        sub.current_period_end = back > now ? back : now;
        sub.credit_paise = Number(sub.credit_paise ?? 0) + Number(pay.credit_applied_paise);
        if (Number(pay.credit_applied_paise) > 0) {
          ledger(db, {
            owner_id: pay.owner_id,
            delta_paise: Number(pay.credit_applied_paise),
            balance_paise: sub.credit_paise,
            reason: `Returned with refund of invoice ${String(pay.invoice_number ?? pay.razorpay_order_id)}`,
            actor: "refund",
          });
        }
      }
    }
    return { ok: true, already: false, owner: pay.owner_id, full };
  },
  adjust_credit(db, a) {
    const sub = ensureSub(db, a.p_owner);
    const bal = Number(sub.credit_paise ?? 0);
    const applied = Math.max(Number(a.p_delta), -bal);
    sub.credit_paise = bal + applied;
    ledger(db, { owner_id: a.p_owner, delta_paise: applied, balance_paise: bal + applied, reason: a.p_reason, actor: a.p_actor });
    return bal + applied;
  },
};

export class MemoryDb implements Db {
  tables = new Map<string, MemoryTable>();
  invoiceSeq = 0;
  /** Postgres function stand-ins. Tests may add or replace entries. */
  functions: Record<string, MemoryFn> = { ...FUNCTIONS };

  table(name: string): MemoryTable {
    let t = this.tables.get(name);
    if (!t) {
      t = new MemoryTable(UNIQUES[name] ?? []);
      this.tables.set(name, t);
    }
    return t;
  }

  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const impl = this.functions[fn];
    if (!impl) throw new Error(`no memory implementation for function ${fn}`);
    return structuredClone(impl(this, args));
  }
}
