import { routeParam, type AppContext } from "../../types/appEnv";
import { refundOrder } from "../../services/billing/refund";
import { parseBody } from "../../validators/body";
import { ApiError } from "../../lib/errors";
import { AdminBonus, AdminCredit, AdminPlanPatch, AdminReason } from "../../validators/schemas";
import { str } from "../../lib/strings";
import { writeAudit } from "../../services/admin/audit";
import { findUser, type AdminContext } from "./context";

export async function changePlan(admin: AdminContext, c: AppContext): Promise<Response> {
  const { db, deps } = admin;
  const body = await parseBody(c, AdminPlanPatch);
  const user = await findUser(db, routeParam(c, "id"));
  if (body.plan !== "free" && body.paidUntil && Date.parse(body.paidUntil) <= deps.now().getTime()) {
    throw new ApiError(422, "invalid_request", "The paid-until date must be in the future.");
  }
  const [before] = await db.table("subscriptions").select({ eq: { owner_id: user.id } });
  const free = { plan: "free", status: "active", source: "free", current_period_end: null, billing_interval: null };
  const paid = { plan: body.plan, status: "active", source: "admin", current_period_end: body.paidUntil, period_start: deps.now().toISOString() };
  const patch = body.plan === "free" ? free : paid;
  await db.table("subscriptions").upsert({ owner_id: user.id, ...patch, updated_at: deps.now().toISOString() }, ["owner_id"]);
  await writeAudit(admin, c, "user.plan_changed", user, body.reason, {
    from: { plan: before?.plan ?? "free", paidUntil: before?.current_period_end ?? null },
    to: { plan: body.plan, paidUntil: body.paidUntil },
  });
  return c.json({ ok: true });
}

export async function setBonus(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminBonus);
  const user = await findUser(admin.db, routeParam(c, "id"));
  const bonus = { campaigns: body.campaigns, attacks: body.attacks, devices: body.devices, projects: body.projects, expires_at: body.expiresAt };
  await admin.db.table("subscriptions").upsert({ owner_id: user.id, bonus, updated_at: admin.deps.now().toISOString() }, ["owner_id"]);
  await writeAudit(admin, c, "user.bonus_set", user, body.reason, bonus);
  return c.json({ ok: true });
}

export async function adjustCredit(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminCredit);
  const user = await findUser(admin.db, routeParam(c, "id"));
  const balance = await admin.db.rpc("adjust_credit", {
    p_owner: str(user.id),
    p_delta: body.deltaPaise,
    p_reason: body.reason,
    p_actor: `admin:${str(c.get("user").email)}`,
  });
  await writeAudit(admin, c, "user.credit_adjusted", user, body.reason, { deltaPaise: body.deltaPaise, balancePaise: balance });
  return c.json({ ok: true, balancePaise: balance });
}

export async function refundPayment(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminReason);
  const user = await findUser(admin.db, routeParam(c, "id"));
  const [order] = await admin.db.table("payments").select({ eq: { id: routeParam(c, "paymentId"), owner_id: user.id } });
  if (!order) throw new ApiError(404, "not_found", "No such payment for this user.");
  const result = await refundOrder(admin.deps, order, { reason: body.reason.slice(0, 250), by: str(c.get("user").email) });
  await writeAudit(admin, c, "user.payment_refunded", user, body.reason, { invoice: order.invoice_number ?? null, refundedPaise: result.refunded });
  return c.json({ ok: true, ...result });
}
