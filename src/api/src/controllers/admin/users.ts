import { routeParam, type AppContext } from "../../types/appEnv";
import { invoiceView } from "../../services/billing/views";
import type { Row } from "../../types/deps";
import { effectivePlan } from "../../services/billing/plans";
import { usageFor } from "../../services/entitlements/usage";
import { str } from "../../lib/strings";
import { auditView } from "../../services/admin/audit";
import { PAGE_SIZE, findUser, isStaffEmail, pageParam, type AdminContext } from "./context";

const NEWEST_FIRST = { column: "created_at", ascending: false };

export async function listUsers(admin: AdminContext, c: AppContext): Promise<Response> {
  const page = pageParam(c);
  const result = await admin.db.rpc("admin_user_list", {
    p_query: (c.req.query("q") ?? "").trim().slice(0, 120),
    p_plan: (c.req.query("plan") ?? "").trim().slice(0, 20),
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  });
  return c.json({ ...(result as object), page, pageSize: PAGE_SIZE });
}

async function loadUserRecords(admin: AdminContext, id: string, now: Date) {
  const { db, deps } = admin;
  const [[subscription], account, usage, payments, ledger, devices, projects, history, mfa] = await Promise.all([
    db.table("subscriptions").select({ eq: { owner_id: id } }),
    deps.authAdmin ? deps.authAdmin.getUser(id) : Promise.resolve(null),
    usageFor(db, id, now),
    db.table("payments").select({ eq: { owner_id: id }, order: NEWEST_FIRST, limit: 100 }),
    db.table("credit_ledger").select({ eq: { owner_id: id }, order: NEWEST_FIRST, limit: 50 }),
    db.table("devices").select({ eq: { owner_id: id }, order: NEWEST_FIRST }),
    db.table("projects").select({ eq: { owner_id: id } }),
    db.table("admin_audit").select({ eq: { target_user_id: id }, order: NEWEST_FIRST, limit: 50 }),
    db.table("admin_mfa").select({ eq: { user_id: id } }),
  ]);
  return { subscription, account, usage, payments, ledger, devices, projects, history, mfa };
}

function subscriptionDetail(subscription: Row | undefined, now: Date) {
  const effective = effectivePlan(subscription, now);
  return {
    effectivePlan: effective.planId,
    storedPlan: effective.storedPlanId,
    lapsed: effective.lapsed,
    status: str(subscription?.status) || "active",
    source: str(subscription?.source) || "free",
    interval: subscription?.billing_interval ?? null,
    paidUntil: subscription?.current_period_end ? str(subscription.current_period_end) : null,
    creditPaise: effective.creditPaise,
    bonus: effective.bonus,
    limits: effective.limits,
    features: effective.features,
  };
}

function paymentView(payment: Row) {
  return { ...invoiceView(payment), razorpayPaymentId: payment.razorpay_payment_id ?? null, orderId: str(payment.razorpay_order_id) };
}

function ledgerView(entry: Row) {
  return {
    id: str(entry.id),
    deltaPaise: Number(entry.delta_paise),
    balancePaise: Number(entry.balance_paise),
    reason: str(entry.reason),
    actor: str(entry.actor),
    createdAt: str(entry.created_at),
  };
}

function deviceView(device: Row) {
  return {
    id: str(device.id),
    name: str(device.name),
    os: str(device.os),
    engineVersion: str(device.engine_version),
    lastSeenAt: device.last_seen_at ? str(device.last_seen_at) : null,
    revoked: Boolean(device.revoked),
    createdAt: str(device.created_at),
  };
}

function syncSettingsView(profile: Row) {
  const settings = (profile.settings as { sync?: Record<string, boolean> } | null) ?? {};
  return { sync: { detailedEvidence: settings.sync?.detailedEvidence === true, transcripts: settings.sync?.transcripts === true } };
}

export async function userDetail(admin: AdminContext, c: AppContext): Promise<Response> {
  const profile = await findUser(admin.db, routeParam(c, "id"));
  const id = str(profile.id);
  const now = admin.deps.now();
  const records = await loadUserRecords(admin, id, now);
  return c.json({
    id,
    email: str(profile.email),
    name: str(profile.display_name),
    createdAt: str(profile.created_at),
    suspendedAt: profile.suspended_at ? str(profile.suspended_at) : null,
    suspendedReason: profile.suspended_reason ? str(profile.suspended_reason) : null,
    isStaff: isStaffEmail(str(profile.email)),
    staffMfaEnrolled: Boolean(records.mfa[0]?.enrolled_at),
    account: records.account,
    subscription: subscriptionDetail(records.subscription, now),
    usage: records.usage.values,
    usagePeriod: records.usage.period,
    payments: records.payments.map(paymentView),
    creditLedger: records.ledger.map(ledgerView),
    devices: records.devices.map(deviceView),
    projects: { total: records.projects.length, active: records.projects.filter((project) => !project.archived).length },
    settings: syncSettingsView(profile),
    audit: records.history.map(auditView),
  });
}
