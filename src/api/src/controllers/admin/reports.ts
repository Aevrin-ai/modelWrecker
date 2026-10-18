import type { Context } from "hono";
import type { AppContext } from "../../types/appEnv";
import { invoiceView } from "../../services/billing/views";
import { str } from "../../lib/strings";
import { auditView } from "../../services/admin/audit";
import { PAGE_SIZE, pageParam, type AdminContext } from "./context";

const NEWEST_FIRST = { column: "created_at", ascending: false };
const TRAFFIC_SITES = ["landing", "dashboard"];

/** The `days` query parameter, kept between 1 and 366 and 30 when unreadable. */
function daysParam(c: Context): number {
  return Math.min(366, Math.max(1, Number(c.req.query("days") ?? 30) || 30));
}

export async function listPayments(admin: AdminContext, c: AppContext): Promise<Response> {
  const page = pageParam(c);
  const status = c.req.query("status");
  const rows = await admin.db.table("payments").select({
    ...(status ? { eq: { status } } : {}),
    order: NEWEST_FIRST,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const owners = [...new Set(rows.map((row) => row.owner_id).filter(Boolean))];
  const profiles = await admin.db.table("profiles").select({ in: { column: "id", values: owners } });
  const emails = new Map(profiles.map((profile) => [str(profile.id), str(profile.email)]));
  const payments = rows.map((row) => ({
    ...invoiceView(row),
    userId: row.owner_id ? str(row.owner_id) : null,
    email: emails.get(str(row.owner_id)) ?? str(row.customer_email),
    orderId: str(row.razorpay_order_id),
    razorpayPaymentId: row.razorpay_payment_id ?? null,
    createdAt: str(row.created_at),
  }));
  return c.json({ page, pageSize: PAGE_SIZE, payments });
}

export async function listAudit(admin: AdminContext, c: AppContext): Promise<Response> {
  const page = pageParam(c);
  const rows = await admin.db.table("admin_audit").select({ order: NEWEST_FIRST, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  return c.json({ page, pageSize: PAGE_SIZE, entries: rows.map(auditView) });
}

export async function metrics(admin: AdminContext, c: AppContext): Promise<Response> {
  return c.json(await admin.db.rpc("admin_metrics", { p_days: daysParam(c) }));
}

export async function traffic(admin: AdminContext, c: AppContext): Promise<Response> {
  const site = c.req.query("site");
  const knownSite = site && TRAFFIC_SITES.includes(site) ? site : "";
  return c.json(await admin.db.rpc("admin_traffic", { p_days: daysParam(c), p_site: knownSite }));
}
