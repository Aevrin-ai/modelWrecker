// Admin console API (issues #43, #44, #45, docs/security/admin.md). Staff only.
//
// Every admin route checks, on the server, in this order:
//   1. a valid Supabase session (requireUser), and the account is not suspended;
//   2. the session's email is verified by the sign-in provider and ends in @aevrin.net;
//   3. an admin session token (X-Admin-Session) issued only after an authenticator code, stored as a hash,
//      bound to this user, at most 8 hours old and used within the last 30 minutes.
// Hiding the console in the UI is not the control. Every change to a user is written to admin_audit.
import type { Context, Hono, MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { parseBody } from "../body";
import type { Deps, Row } from "../db";
import { ApiError, RateLimiter, randomToken, sha256Hex } from "../lib";
import { effectivePlan } from "../plans";
import {
  AdminBonus,
  AdminCredit,
  AdminDelete,
  AdminPlanPatch,
  AdminProfile,
  AdminReason,
  AdminSettings,
  AdminSuspend,
  MfaCodeReq,
} from "../schemas";
import { usageFor } from "../usage";
import { invoiceView, refundOrder } from "./billing";
import { str } from "./shared";
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUri, verifyTotp } from "../admin/totp";

const STAFF_DOMAIN = "aevrin.net";
const ADMIN_SESSION_HEADER = "x-admin-session";
const ADMIN_TOKEN_PREFIX = "mwa_";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const RECOVERY_CODES = 10;
const PAGE = 50;

/** A staff email: verified, and exactly on the staff domain (not a subdomain, not a look-alike). */
export function isStaffEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return at > 0 && e.slice(at + 1) === STAFF_DOMAIN;
}

function recoveryCode(): string {
  const alphabet = "BCDFGHJKLMNPQRSTVWXZ23456789";
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  const chars = [...buf].map((b) => alphabet[b % alphabet.length]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

export function registerAdminRoutes(app: Hono<AppEnv>, deps: Deps, requireUser: MiddlewareHandler<AppEnv>) {
  const limiter = new RateLimiter();
  const ip = (c: Context) => c.req.header("cf-connecting-ip") ?? "local";
  const limit = (key: string, max: number, windowMs = 60_000) => {
    if (!limiter.allow(key, max, windowMs, deps.now().getTime())) {
      throw new ApiError(429, "rate_limited", "Too many requests. Wait a moment and try again.");
    }
  };
  const db = deps.serviceDb;

  const totpKey = () => {
    if (!deps.admin?.totpKey) throw new ApiError(503, "admin_unavailable", "The admin console is not configured.");
    return deps.admin.totpKey;
  };

  /** Steps 1 and 2: a signed-in, verified staff account. */
  const staff: MiddlewareHandler<AppEnv> = async (c, next) => {
    totpKey();
    limit(`admin:${ip(c)}`, 240);
    const user = c.get("user");
    if (!isStaffEmail(user.email) || user.emailVerified !== true) {
      throw new ApiError(403, "admin_only", `The admin console is only for verified @${STAFF_DOMAIN} accounts.`);
    }
    await next();
  };

  /** Step 3: a live admin session, issued after an authenticator code. */
  const admin: MiddlewareHandler<AppEnv> = async (c, next) => {
    const token = c.req.header(ADMIN_SESSION_HEADER) ?? "";
    if (!token.startsWith(ADMIN_TOKEN_PREFIX)) throw new ApiError(401, "admin_session_required", "Enter your authenticator code.");
    const [session] = await db.table("admin_sessions").select({ eq: { token_hash: await sha256Hex(token) } });
    const now = deps.now().getTime();
    const valid =
      session &&
      session.user_id === c.get("user").id &&
      !session.revoked_at &&
      Date.parse(str(session.expires_at)) > now &&
      now - Date.parse(str(session.last_seen_at)) < SESSION_IDLE_MS;
    if (!valid) throw new ApiError(401, "admin_session_required", "Your admin session ended. Enter your authenticator code.");
    await db.table("admin_sessions").update({ id: session.id }, { last_seen_at: deps.now().toISOString() });
    c.set("adminSession", session);
    await next();
  };

  const audit = async (c: Context<AppEnv>, action: string, target: Row | null, reason: string | null, detail: Record<string, unknown> = {}) => {
    const user = c.get("user");
    await db.table("admin_audit").insert({
      admin_id: user.id,
      admin_email: str(user.email),
      action,
      target_user_id: target ? str(target.id) : null,
      target_email: target ? str(target.email) || null : null,
      reason,
      detail,
      ip: ip(c),
      created_at: deps.now().toISOString(),
    });
  };

  const startSession = async (c: Context<AppEnv>) => {
    const token = `${ADMIN_TOKEN_PREFIX}${randomToken(32)}`;
    const now = deps.now();
    const expires = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    await db.table("admin_sessions").insert({
      user_id: c.get("user").id,
      token_hash: await sha256Hex(token),
      ip: ip(c),
      created_at: now.toISOString(),
      last_seen_at: now.toISOString(),
      expires_at: expires,
    });
    return { sessionToken: token, expiresAt: expires };
  };

  /** Check a code or recovery code against the stored authenticator, with lockout and replay protection. */
  const checkSecondFactor = async (c: Context<AppEnv>, mfa: Row, body: { code?: string; recoveryCode?: string }, pending: boolean) => {
    const now = deps.now();
    if (mfa.locked_until && Date.parse(str(mfa.locked_until)) > now.getTime()) {
      throw new ApiError(429, "locked", "Too many wrong codes. Try again in 15 minutes.");
    }
    let ok = false;
    const patch: Row = {};
    if (body.code) {
      const secret = await decryptSecret(totpKey(), str(mfa.secret_enc));
      const step = await verifyTotp(secret, body.code, now.getTime(), Number(mfa.last_step ?? 0));
      if (step !== null) {
        ok = true;
        patch.last_step = step;
      }
    } else if (body.recoveryCode && !pending) {
      const hash = await sha256Hex(body.recoveryCode.trim().toUpperCase());
      const left = ((mfa.recovery_hashes as string[]) ?? []).filter((h) => h !== hash);
      if (left.length < ((mfa.recovery_hashes as string[]) ?? []).length) {
        ok = true;
        patch.recovery_hashes = left; // each recovery code works once
      }
    }
    if (!ok) {
      const failures = Number(mfa.failed_count ?? 0) + 1;
      await db.table("admin_mfa").update(
        { user_id: mfa.user_id },
        failures >= MAX_FAILURES ? { failed_count: 0, locked_until: new Date(now.getTime() + LOCK_MS).toISOString() } : { failed_count: failures },
      );
      await audit(c, "admin.mfa_failed", null, null, { failures });
      throw new ApiError(400, "invalid_code", "That code is not right. Check the time on your phone and try again.");
    }
    await db.table("admin_mfa").update({ user_id: mfa.user_id }, { ...patch, failed_count: 0, locked_until: null });
  };

  // --- access ----------------------------------------------------------------------------------------

  app.get("/admin/mfa/status", requireUser, staff, async (c) => {
    const [mfa] = await db.table("admin_mfa").select({ eq: { user_id: c.get("user").id } });
    const locked = Boolean(mfa?.locked_until && Date.parse(str(mfa.locked_until)) > deps.now().getTime());
    return c.json({ email: c.get("user").email, enrolled: Boolean(mfa?.enrolled_at), locked });
  });

  app.post("/admin/mfa/enroll", requireUser, staff, async (c) => {
    const user = c.get("user");
    limit(`admin-enroll:${user.id}`, 5);
    const [mfa] = await db.table("admin_mfa").select({ eq: { user_id: user.id } });
    if (mfa?.enrolled_at) throw new ApiError(409, "already_enrolled", "An authenticator is already set up for this account.");
    const secret = newTotpSecret();
    await db.table("admin_mfa").upsert(
      { user_id: user.id, email: str(user.email), secret_enc: await encryptSecret(totpKey(), secret), enrolled_at: null, last_step: 0, failed_count: 0, locked_until: null, recovery_hashes: [] },
      ["user_id"],
    );
    // The secret is shown once, to this signed-in staff member, so their app can be set up.
    return c.json({ secret, otpauthUri: otpauthUri(secret, str(user.email)) });
  });

  app.post("/admin/mfa/activate", requireUser, staff, async (c) => {
    const user = c.get("user");
    limit(`admin-mfa:${user.id}`, 10);
    const body = await parseBody(c, MfaCodeReq);
    const [mfa] = await db.table("admin_mfa").select({ eq: { user_id: user.id } });
    if (!mfa) throw new ApiError(409, "not_enrolled", "Start the authenticator setup first.");
    if (mfa.enrolled_at) throw new ApiError(409, "already_enrolled", "An authenticator is already set up for this account.");
    if (!body.code) throw new ApiError(400, "invalid_code", "Enter the 6-digit code from your authenticator app.");
    await checkSecondFactor(c, mfa, body, true);
    const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode);
    await db.table("admin_mfa").update(
      { user_id: user.id },
      { enrolled_at: deps.now().toISOString(), recovery_hashes: await Promise.all(codes.map((r) => sha256Hex(r))) },
    );
    await audit(c, "admin.mfa_enrolled", null, null);
    return c.json({ ...(await startSession(c)), recoveryCodes: codes });
  });

  app.post("/admin/mfa/verify", requireUser, staff, async (c) => {
    const user = c.get("user");
    limit(`admin-mfa:${user.id}`, 10);
    const body = await parseBody(c, MfaCodeReq);
    const [mfa] = await db.table("admin_mfa").select({ eq: { user_id: user.id } });
    if (!mfa?.enrolled_at) throw new ApiError(409, "not_enrolled", "Set up an authenticator first.");
    await checkSecondFactor(c, mfa, body, false);
    await audit(c, body.recoveryCode ? "admin.signin_recovery_code" : "admin.signin", null, null);
    return c.json(await startSession(c));
  });

  app.post("/admin/session/end", requireUser, staff, admin, async (c) => {
    await db.table("admin_sessions").update({ id: c.get("adminSession").id }, { revoked_at: deps.now().toISOString() });
    return c.body(null, 204);
  });

  app.get("/admin/me", requireUser, staff, admin, (c) =>
    c.json({ email: c.get("user").email, name: c.get("user").name, sessionExpiresAt: c.get("adminSession").expires_at }),
  );

  // --- users -----------------------------------------------------------------------------------------

  const target = async (id: string): Promise<Row> => {
    const [p] = await db.table("profiles").select({ eq: { id } });
    if (!p) throw new ApiError(404, "not_found", "No such user.");
    return p;
  };

  app.get("/admin/users", requireUser, staff, admin, async (c) => {
    const page = Math.max(0, Number(c.req.query("page") ?? 0) || 0);
    const result = await db.rpc("admin_user_list", {
      p_query: (c.req.query("q") ?? "").trim().slice(0, 120),
      p_plan: (c.req.query("plan") ?? "").trim().slice(0, 20),
      p_limit: PAGE,
      p_offset: page * PAGE,
    });
    return c.json({ ...(result as object), page, pageSize: PAGE });
  });

  app.get("/admin/users/:id", requireUser, staff, admin, async (c) => {
    const p = await target(c.req.param("id"));
    const id = str(p.id);
    const now = deps.now();
    const [[sub], account, usage, payments, ledger, devices, projects, history, mfa] = await Promise.all([
      db.table("subscriptions").select({ eq: { owner_id: id } }),
      deps.authAdmin ? deps.authAdmin.getUser(id) : Promise.resolve(null),
      usageFor(db, id, now),
      db.table("payments").select({ eq: { owner_id: id }, order: { column: "created_at", ascending: false }, limit: 100 }),
      db.table("credit_ledger").select({ eq: { owner_id: id }, order: { column: "created_at", ascending: false }, limit: 50 }),
      db.table("devices").select({ eq: { owner_id: id }, order: { column: "created_at", ascending: false } }),
      db.table("projects").select({ eq: { owner_id: id } }),
      db.table("admin_audit").select({ eq: { target_user_id: id }, order: { column: "created_at", ascending: false }, limit: 50 }),
      db.table("admin_mfa").select({ eq: { user_id: id } }),
    ]);
    const eff = effectivePlan(sub, now);
    const settings = (p.settings as { sync?: Record<string, boolean> } | null) ?? {};
    return c.json({
      id,
      email: str(p.email),
      name: str(p.display_name),
      createdAt: str(p.created_at),
      suspendedAt: p.suspended_at ? str(p.suspended_at) : null,
      suspendedReason: p.suspended_reason ? str(p.suspended_reason) : null,
      isStaff: isStaffEmail(str(p.email)),
      staffMfaEnrolled: Boolean(mfa[0]?.enrolled_at),
      account,
      subscription: {
        effectivePlan: eff.planId,
        storedPlan: eff.storedPlanId,
        lapsed: eff.lapsed,
        status: str(sub?.status) || "active",
        source: str(sub?.source) || "free",
        interval: sub?.billing_interval ?? null,
        paidUntil: sub?.current_period_end ? str(sub.current_period_end) : null,
        creditPaise: eff.creditPaise,
        bonus: eff.bonus,
        limits: eff.limits,
        features: eff.features,
      },
      usage: usage.values,
      usagePeriod: usage.period,
      payments: payments.map((x) => ({ ...invoiceView(x), razorpayPaymentId: x.razorpay_payment_id ?? null, orderId: str(x.razorpay_order_id) })),
      creditLedger: ledger.map((l) => ({ id: str(l.id), deltaPaise: Number(l.delta_paise), balancePaise: Number(l.balance_paise), reason: str(l.reason), actor: str(l.actor), createdAt: str(l.created_at) })),
      devices: devices.map((d) => ({ id: str(d.id), name: str(d.name), os: str(d.os), engineVersion: str(d.engine_version), lastSeenAt: d.last_seen_at ? str(d.last_seen_at) : null, revoked: Boolean(d.revoked), createdAt: str(d.created_at) })),
      projects: { total: projects.length, active: projects.filter((x) => !x.archived).length },
      settings: { sync: { detailedEvidence: settings.sync?.detailedEvidence === true, transcripts: settings.sync?.transcripts === true } },
      audit: history.map(auditView),
    });
  });

  app.patch("/admin/users/:id/plan", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminPlanPatch);
    const p = await target(c.req.param("id"));
    if (body.plan !== "free" && body.paidUntil && Date.parse(body.paidUntil) <= deps.now().getTime()) {
      throw new ApiError(422, "invalid_request", "The paid-until date must be in the future.");
    }
    const [before] = await db.table("subscriptions").select({ eq: { owner_id: p.id } });
    const patch =
      body.plan === "free"
        ? { plan: "free", status: "active", source: "free", current_period_end: null, billing_interval: null }
        : { plan: body.plan, status: "active", source: "admin", current_period_end: body.paidUntil, period_start: deps.now().toISOString() };
    await db.table("subscriptions").upsert({ owner_id: p.id, ...patch, updated_at: deps.now().toISOString() }, ["owner_id"]);
    await audit(c, "user.plan_changed", p, body.reason, {
      from: { plan: before?.plan ?? "free", paidUntil: before?.current_period_end ?? null },
      to: { plan: body.plan, paidUntil: body.paidUntil },
    });
    return c.json({ ok: true });
  });

  app.post("/admin/users/:id/bonus", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminBonus);
    const p = await target(c.req.param("id"));
    const bonus = { campaigns: body.campaigns, attacks: body.attacks, devices: body.devices, projects: body.projects, expires_at: body.expiresAt };
    await db.table("subscriptions").upsert({ owner_id: p.id, bonus, updated_at: deps.now().toISOString() }, ["owner_id"]);
    await audit(c, "user.bonus_set", p, body.reason, bonus);
    return c.json({ ok: true });
  });

  app.post("/admin/users/:id/credit", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminCredit);
    const p = await target(c.req.param("id"));
    const balance = await db.rpc("adjust_credit", {
      p_owner: str(p.id),
      p_delta: body.deltaPaise,
      p_reason: body.reason,
      p_actor: `admin:${str(c.get("user").email)}`,
    });
    await audit(c, "user.credit_adjusted", p, body.reason, { deltaPaise: body.deltaPaise, balancePaise: balance });
    return c.json({ ok: true, balancePaise: balance });
  });

  app.post("/admin/users/:id/payments/:paymentId/refund", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminReason);
    const p = await target(c.req.param("id"));
    const [order] = await db.table("payments").select({ eq: { id: c.req.param("paymentId"), owner_id: p.id } });
    if (!order) throw new ApiError(404, "not_found", "No such payment for this user.");
    const result = await refundOrder(deps, order, { reason: body.reason.slice(0, 250), by: str(c.get("user").email) });
    await audit(c, "user.payment_refunded", p, body.reason, { invoice: order.invoice_number ?? null, refundedPaise: result.refunded });
    return c.json({ ok: true, ...result });
  });

  app.patch("/admin/users/:id/settings", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminSettings);
    const p = await target(c.req.param("id"));
    const cur = (p.settings as { sync?: Record<string, boolean>; notifications?: Record<string, boolean> } | null) ?? {};
    const sync = { metadata: true, detailedEvidence: body.sync.detailedEvidence, transcripts: body.sync.transcripts };
    await db.table("profiles").update({ id: p.id }, { settings: { ...cur, sync } });
    // Same rule as the user's own Settings: turning detail off removes the copies in the cloud.
    if (!sync.detailedEvidence) {
      await db.table("finding_evidence").delete({ owner_id: p.id });
      await db.table("findings").update({ owner_id: p.id, evidence_synced: true }, { evidence_synced: false });
    }
    if (!sync.transcripts) await db.table("run_transcripts").delete({ owner_id: p.id });
    await audit(c, "user.settings_changed", p, body.reason, { sync });
    return c.json({ ok: true });
  });

  app.patch("/admin/users/:id/profile", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminProfile);
    const p = await target(c.req.param("id"));
    await db.table("profiles").update({ id: p.id }, { display_name: body.displayName });
    await audit(c, "user.renamed", p, body.reason, { from: p.display_name ?? null, to: body.displayName });
    return c.json({ ok: true });
  });

  app.post("/admin/users/:id/devices/:deviceId/revoke", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminReason);
    const p = await target(c.req.param("id"));
    const n = await db.table("devices").update({ id: c.req.param("deviceId"), owner_id: p.id }, { revoked: true });
    if (n.length === 0) throw new ApiError(404, "not_found", "No such device for this user.");
    await audit(c, "user.device_revoked", p, body.reason, { device: c.req.param("deviceId"), name: n[0].name ?? null });
    return c.json({ ok: true });
  });

  app.post("/admin/users/:id/suspend", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminSuspend);
    const p = await target(c.req.param("id"));
    if (str(p.id) === c.get("user").id) throw new ApiError(409, "self", "You cannot suspend your own account.");
    if (deps.authAdmin) await deps.authAdmin.setBanned(str(p.id), body.suspended);
    await db.table("profiles").update(
      { id: p.id },
      body.suspended ? { suspended_at: deps.now().toISOString(), suspended_reason: body.reason } : { suspended_at: null, suspended_reason: null },
    );
    await audit(c, body.suspended ? "user.suspended" : "user.unsuspended", p, body.reason);
    return c.json({ ok: true });
  });

  app.post("/admin/users/:id/reset-mfa", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminReason);
    const p = await target(c.req.param("id"));
    if (str(p.id) === c.get("user").id) throw new ApiError(409, "self", "Ask another admin to reset your own authenticator.");
    await db.table("admin_mfa").delete({ user_id: p.id });
    await db.table("admin_sessions").update({ user_id: p.id }, { revoked_at: deps.now().toISOString() });
    await audit(c, "admin.mfa_reset", p, body.reason);
    return c.json({ ok: true });
  });

  app.delete("/admin/users/:id", requireUser, staff, admin, async (c) => {
    const body = await parseBody(c, AdminDelete);
    const p = await target(c.req.param("id"));
    if (str(p.id) === c.get("user").id) throw new ApiError(409, "self", "You cannot delete your own account here.");
    if (isStaffEmail(str(p.email))) throw new ApiError(409, "staff", "Staff accounts are removed by the domain owner, not from the console.");
    if (body.confirmEmail.toLowerCase() !== str(p.email).toLowerCase()) {
      throw new ApiError(422, "confirm_mismatch", "Type the user's email exactly to confirm.");
    }
    if (!deps.authAdmin) throw new ApiError(503, "admin_unavailable", "Account deletion is not configured.");
    // Payments are financial records: keep them, detached from the account, with the email they were for.
    await db.table("payments").update({ owner_id: p.id }, { customer_email: str(p.email) });
    await audit(c, "user.deleted", p, body.reason, { name: p.display_name ?? null });
    await deps.authAdmin.deleteUser(str(p.id)); // cascades to every row the user owns
    return c.json({ ok: true });
  });

  // --- payments, audit, analytics ------------------------------------------------------------------

  app.get("/admin/payments", requireUser, staff, admin, async (c) => {
    const page = Math.max(0, Number(c.req.query("page") ?? 0) || 0);
    const status = c.req.query("status");
    const rows = await db.table("payments").select({
      ...(status ? { eq: { status } } : {}),
      order: { column: "created_at", ascending: false },
      limit: PAGE,
      offset: page * PAGE,
    });
    const owners = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))];
    const profiles = await db.table("profiles").select({ in: { column: "id", values: owners } });
    const email = new Map(profiles.map((p) => [str(p.id), str(p.email)]));
    return c.json({
      page,
      pageSize: PAGE,
      payments: rows.map((r) => ({
        ...invoiceView(r),
        userId: r.owner_id ? str(r.owner_id) : null,
        email: email.get(str(r.owner_id)) ?? str(r.customer_email),
        orderId: str(r.razorpay_order_id),
        razorpayPaymentId: r.razorpay_payment_id ?? null,
        createdAt: str(r.created_at),
      })),
    });
  });

  app.get("/admin/audit", requireUser, staff, admin, async (c) => {
    const page = Math.max(0, Number(c.req.query("page") ?? 0) || 0);
    const rows = await db.table("admin_audit").select({ order: { column: "created_at", ascending: false }, limit: PAGE, offset: page * PAGE });
    return c.json({ page, pageSize: PAGE, entries: rows.map(auditView) });
  });

  const days = (c: Context) => Math.min(366, Math.max(1, Number(c.req.query("days") ?? 30) || 30));

  app.get("/admin/metrics", requireUser, staff, admin, async (c) => c.json(await db.rpc("admin_metrics", { p_days: days(c) })));

  app.get("/admin/traffic", requireUser, staff, admin, async (c) => {
    const site = c.req.query("site");
    return c.json(await db.rpc("admin_traffic", { p_days: days(c), p_site: site === "landing" || site === "dashboard" ? site : "" }));
  });
}

function auditView(a: Row) {
  return {
    id: str(a.id),
    adminEmail: str(a.admin_email),
    action: str(a.action),
    targetUserId: a.target_user_id ? str(a.target_user_id) : null,
    targetEmail: a.target_email ? str(a.target_email) : null,
    reason: a.reason ? str(a.reason) : null,
    detail: (a.detail as Record<string, unknown>) ?? {},
    createdAt: str(a.created_at),
  };
}
