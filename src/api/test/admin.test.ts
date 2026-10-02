// Admin console (issues #43, #44, #45), offline. Staff access, authenticator codes, sessions, user
// management, audit, and page analytics.
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, runMaintenance } from "../src/app";
import { MemoryDb } from "../src/db/memory";
import type { AuthAccount, AuthAdmin, AuthUser, Deps } from "../src/db";
import { base32Encode, decryptSecret, encryptSecret, totpAt, verifyTotp } from "../src/admin/totp";
import { isStaffEmail } from "../src/routes/admin";
import { cleanPath, deviceType, referrerHost } from "../src/routes/collect";
import type { RazorpayApi } from "../src/razorpay";

const USERS: Record<string, AuthUser> = {
  "token-s": { id: "staff-1", email: "ops@aevrin.net", name: "Ops", emailVerified: true },
  "token-s2": { id: "staff-2", email: "Lead@Aevrin.net", name: "Lead", emailVerified: true },
  "token-unverified": { id: "staff-3", email: "new@aevrin.net", name: "New", emailVerified: false },
  "token-a": { id: "user-a", email: "a@example.com", name: "Alice", emailVerified: true },
  "token-lookalike": { id: "user-l", email: "x@aevrin.net.evil.com", name: "X", emailVerified: true },
};
const TOTP_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

class FakeAuthAdmin implements AuthAdmin {
  banned = new Set<string>();
  deleted: string[] = [];
  constructor(private db: MemoryDb) {}
  async getUser(id: string): Promise<AuthAccount | null> {
    const p = this.db.table("profiles").rows.find((r) => r.id === id);
    return p ? { id, email: String(p.email), createdAt: null, lastSignInAt: null, bannedUntil: this.banned.has(id) ? "2126-01-01" : null, providers: ["google"] } : null;
  }
  async setBanned(id: string, banned: boolean) {
    if (banned) this.banned.add(id);
    else this.banned.delete(id);
  }
  async deleteUser(id: string) {
    this.deleted.push(id);
    // ON DELETE CASCADE from auth.users -> profiles -> everything owned; payments are SET NULL.
    for (const [name, t] of this.db.tables) {
      if (name === "payments") t.rows.forEach((r) => r.owner_id === id && (r.owner_id = null));
      else if (name === "profiles") t.rows = t.rows.filter((r) => r.id !== id);
      else if (name !== "admin_audit") t.rows = t.rows.filter((r) => r.owner_id !== id && r.user_id !== id);
    }
  }
}

let db: MemoryDb;
let clock: number;
let auth: FakeAuthAdmin;
let refunds: string[];
let app: ReturnType<typeof createApp>;

const rzp: RazorpayApi = {
  createOrder: async () => ({ id: "order_X", amount: 0, currency: "INR", status: "created" }),
  fetchPayment: async () => {
    throw new Error("unused");
  },
  capturePayment: async () => {
    throw new Error("unused");
  },
  orderPayments: async () => [],
  refund: async (id) => {
    refunds.push(id);
    return { id: "rfnd_1", status: "processed", amount: 89900 };
  },
};

function deps(over: Partial<Deps> = {}): Deps {
  return {
    serviceDb: db,
    userDb: () => db,
    verifyUser: async (t) => USERS[t] ?? null,
    appOrigin: "https://app.aevrin.net",
    now: () => new Date(clock),
    authAdmin: auth,
    admin: { totpKey: TOTP_KEY },
    analyticsSalt: "salt",
    billing: { keyId: "rzp_test", keySecret: "s", webhookSecret: "w", api: rzp },
    ...over,
  };
}

beforeEach(() => {
  db = new MemoryDb();
  clock = Date.parse("2026-10-02T10:00:00Z");
  auth = new FakeAuthAdmin(db);
  refunds = [];
  app = createApp(deps());
  for (const u of Object.values(USERS)) {
    db.table("profiles").rows.push({ id: u.id, email: u.email, display_name: u.name, created_at: "2026-09-01T00:00:00Z", settings: {} });
  }
});

const call = (method: string, path: string, opts: { token?: string; session?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}) =>
  app.request(`/api/v1${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.session ? { "x-admin-session": opts.session } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
const json = async (res: Response) => (await res.json()) as Record<string, any>;

/** Enroll the staff member's authenticator and return the secret and an admin session token. */
async function enroll(token = "token-s") {
  const start = await json(await call("POST", "/admin/mfa/enroll", { token }));
  const code = await totpAt(start.secret, clock);
  const res = await call("POST", "/admin/mfa/activate", { token, body: { code } });
  expect(res.status).toBe(200);
  const body = await json(res);
  return { secret: start.secret as string, session: body.sessionToken as string, recovery: body.recoveryCodes as string[] };
}

describe("authenticator codes (RFC 6238)", () => {
  it("matches the RFC test vector and refuses a reused step", async () => {
    const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
    expect(await totpAt(secret, 59_000)).toBe("287082"); // RFC 6238 appendix B, last 6 digits
    expect(await verifyTotp(secret, "287082", 59_000, 0)).toBe(1);
    expect(await verifyTotp(secret, "287082", 59_000, 1)).toBeNull();
    expect(await verifyTotp(secret, "000000", 59_000, 0)).toBeNull();
    expect(await verifyTotp(secret, "28708", 59_000, 0)).toBeNull();
  });

  it("encrypts secrets with a fresh IV and decrypts them", async () => {
    const a = await encryptSecret(TOTP_KEY, "JBSWY3DPEHPK3PXP");
    const b = await encryptSecret(TOTP_KEY, "JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(await decryptSecret(TOTP_KEY, a)).toBe("JBSWY3DPEHPK3PXP");
  });
});

describe("staff-only access (issue #43)", () => {
  it("accepts only a verified address exactly on aevrin.net", async () => {
    expect(isStaffEmail("ops@aevrin.net")).toBe(true);
    expect(isStaffEmail("Lead@AEVRIN.NET")).toBe(true);
    for (const bad of ["x@aevrin.net.evil.com", "x@evilaevrin.net", "x@sub.aevrin.net", "aevrin.net", "", null]) {
      expect(isStaffEmail(bad)).toBe(false);
    }
    for (const token of ["token-a", "token-lookalike", "token-unverified"]) {
      const res = await call("GET", "/admin/mfa/status", { token });
      expect(res.status).toBe(403);
      expect((await json(res)).error).toBe("admin_only");
    }
    expect((await call("GET", "/admin/mfa/status")).status).toBe(401);
  });

  it("refuses every admin route without an admin session, even for staff", async () => {
    for (const path of ["/admin/users", "/admin/users/user-a", "/admin/metrics", "/admin/traffic", "/admin/audit", "/admin/payments", "/admin/me"]) {
      expect((await call("GET", path, { token: "token-s" })).status).toBe(401);
    }
    const res = await call("PATCH", "/admin/users/user-a/plan", { token: "token-s", body: { plan: "pro", paidUntil: null, reason: "test" } });
    expect(res.status).toBe(401);
  });

  it("answers 503 when the admin console is not configured", async () => {
    app = createApp(deps({ admin: undefined }));
    expect((await call("GET", "/admin/mfa/status", { token: "token-s" })).status).toBe(503);
  });

  it("enrolls, stores the secret encrypted, and starts a session", async () => {
    const { secret, session, recovery } = await enroll();
    const row = db.table("admin_mfa").rows[0];
    expect(row.secret_enc).not.toContain(secret);
    expect(JSON.stringify(row)).not.toContain(recovery[0]);
    expect(recovery).toHaveLength(10);
    expect(db.table("admin_sessions").rows[0].token_hash).not.toBe(session);
    const me = await json(await call("GET", "/admin/me", { token: "token-s", session }));
    expect(me.email).toBe("ops@aevrin.net");
    expect((await call("POST", "/admin/mfa/enroll", { token: "token-s" })).status).toBe(409);
  });

  it("never accepts the same code twice, and accepts the next one", async () => {
    const { secret } = await enroll();
    const reused = await call("POST", "/admin/mfa/verify", { token: "token-s", body: { code: await totpAt(secret, clock) } });
    expect(reused.status).toBe(400);
    clock += 30_000;
    const next = await call("POST", "/admin/mfa/verify", { token: "token-s", body: { code: await totpAt(secret, clock) } });
    expect(next.status).toBe(200);
  });

  it("locks after five wrong codes", async () => {
    const { secret } = await enroll();
    clock += 30_000;
    for (let i = 0; i < 5; i++) {
      expect((await call("POST", "/admin/mfa/verify", { token: "token-s", body: { code: "000000" } })).status).toBe(400);
    }
    const locked = await call("POST", "/admin/mfa/verify", { token: "token-s", body: { code: await totpAt(secret, clock) } });
    expect(locked.status).toBe(429);
    clock += 16 * 60_000;
    expect((await call("POST", "/admin/mfa/verify", { token: "token-s", body: { code: await totpAt(secret, clock) } })).status).toBe(200);
  });

  it("accepts each recovery code once", async () => {
    const { recovery } = await enroll();
    expect((await call("POST", "/admin/mfa/verify", { token: "token-s", body: { recoveryCode: recovery[0] } })).status).toBe(200);
    expect((await call("POST", "/admin/mfa/verify", { token: "token-s", body: { recoveryCode: recovery[0] } })).status).toBe(400);
  });

  it("binds a session to its staff member and ends it when idle or after 8 hours", async () => {
    const { session, secret } = await enroll();
    await enroll("token-s2");
    expect((await call("GET", "/admin/me", { token: "token-s2", session })).status).toBe(401);
    clock += 31 * 60_000;
    expect((await call("GET", "/admin/me", { token: "token-s", session })).status).toBe(401);

    // A fresh code gives a new session; staying active keeps it alive, but never past 8 hours.
    const fresh = (await json(await call("POST", "/admin/mfa/verify", { token: "token-s", body: { code: await totpAt(secret, clock) } }))).sessionToken;
    for (let minutes = 25; minutes <= 475; minutes += 25) {
      clock += 25 * 60_000;
      expect((await call("GET", "/admin/me", { token: "token-s", session: fresh })).status).toBe(200);
    }
    clock += 25 * 60_000; // 500 minutes after it started
    expect((await call("GET", "/admin/me", { token: "token-s", session: fresh })).status).toBe(401);
  });

  it("ends a session on request", async () => {
    const { session } = await enroll();
    expect((await call("POST", "/admin/session/end", { token: "token-s", session })).status).toBe(204);
    expect((await call("GET", "/admin/me", { token: "token-s", session })).status).toBe(401);
  });
});

describe("user management (issue #44)", () => {
  let session: string;
  beforeEach(async () => {
    session = (await enroll()).session;
  });
  const admin = (method: string, path: string, body?: unknown) => call(method, path, { token: "token-s", session, body });

  it("changes a plan, sets a bonus and credit, and audits each with its reason", async () => {
    expect((await admin("PATCH", "/admin/users/user-a/plan", { plan: "pro", paidUntil: "2027-01-01T00:00:00Z" })).status).toBe(422);
    expect((await admin("PATCH", "/admin/users/user-a/plan", { plan: "pro", paidUntil: "2027-01-01T00:00:00Z", reason: "launch partner" })).status).toBe(200);
    expect((await admin("POST", "/admin/users/user-a/bonus", { campaigns: 50, attacks: 5000, devices: 0, projects: 2, expiresAt: null, reason: "beta tester" })).status).toBe(200);
    const credit = await json(await admin("POST", "/admin/users/user-a/credit", { deltaPaise: 50000, reason: "outage goodwill" }));
    expect(credit.balancePaise).toBe(50000);

    const detail = await json(await admin("GET", "/admin/users/user-a"));
    expect(detail.subscription).toMatchObject({ effectivePlan: "pro", source: "admin", creditPaise: 50000 });
    expect(detail.subscription.limits.campaigns).toBe(350);
    expect(detail.creditLedger[0]).toMatchObject({ deltaPaise: 50000, actor: "admin:ops@aevrin.net" });
    expect(detail.audit.map((a: any) => a.action)).toEqual(["user.credit_adjusted", "user.bonus_set", "user.plan_changed"]);
    expect(detail.audit[2]).toMatchObject({ adminEmail: "ops@aevrin.net", targetEmail: "a@example.com", reason: "launch partner" });

    // The user's own API now reflects it.
    const sub = await json(await call("GET", "/subscription", { token: "token-a" }));
    expect(sub).toMatchObject({ planId: "pro", source: "admin", creditPaise: 50000 });
  });

  it("refunds a paid purchase through Razorpay and takes back its time", async () => {
    db.table("subscriptions").rows.push({ owner_id: "user-a", plan: "pro", status: "active", source: "payment", current_period_end: "2026-11-02T10:00:00.000Z", credit_paise: 0, bonus: {} });
    db.table("payments").rows.push({
      id: "pay-row-1", owner_id: "user-a", razorpay_order_id: "order_A", razorpay_payment_id: "pay_A", plan: "pro", billing_interval: "month", months: 1,
      list_price_paise: 89900, credit_applied_paise: 0, amount_paise: 89900, amount_refunded_paise: 0, currency: "INR", status: "paid", invoice_number: "AEV-2026-000001", created_at: "2026-10-02T10:00:00Z",
    });
    expect((await admin("POST", "/admin/users/user-a/payments/pay-row-1/refund", { reason: "asked within 7 days" })).status).toBe(200);
    expect(refunds).toEqual(["pay_A"]);
    expect(db.table("payments").rows[0].status).toBe("refunded");
    expect((await json(await call("GET", "/subscription", { token: "token-a" }))).planId).toBe("free");
  });

  it("revokes a device and changes sync settings", async () => {
    db.table("devices").rows.push({ id: "dev-1", owner_id: "user-a", name: "laptop", revoked: false, credential_hash: "h" });
    db.table("finding_evidence").rows.push({ finding_id: "f", owner_id: "user-a" });
    expect((await admin("POST", "/admin/users/user-a/devices/dev-1/revoke", { reason: "lost laptop" })).status).toBe(200);
    expect(db.table("devices").rows[0].revoked).toBe(true);
    expect((await admin("PATCH", "/admin/users/user-a/settings", { sync: { detailedEvidence: false, transcripts: false }, reason: "user request" })).status).toBe(200);
    expect(db.table("finding_evidence").rows).toHaveLength(0);
  });

  it("suspends and restores an account, blocking its API and sign-in", async () => {
    expect((await admin("POST", "/admin/users/user-a/suspend", { suspended: true, reason: "abuse report" })).status).toBe(200);
    expect(auth.banned.has("user-a")).toBe(true);
    const blocked = await call("GET", "/me", { token: "token-a" });
    expect(blocked.status).toBe(403);
    expect((await json(blocked)).error).toBe("account_suspended");
    expect((await admin("POST", "/admin/users/user-a/suspend", { suspended: false, reason: "resolved" })).status).toBe(200);
    expect((await call("GET", "/me", { token: "token-a" })).status).toBe(200);
    expect((await admin("POST", "/admin/users/staff-1/suspend", { suspended: true, reason: "oops" })).status).toBe(409);
  });

  it("deletes a user only with the email typed, keeps their payments, and never deletes staff", async () => {
    db.table("payments").rows.push({ id: "p1", owner_id: "user-a", razorpay_order_id: "order_B", status: "paid", amount_paise: 89900 });
    db.table("projects").rows.push({ id: "pr1", owner_id: "user-a", name: "x" });
    expect((await call("DELETE", "/admin/users/user-a", { token: "token-s", session, body: { confirmEmail: "wrong@example.com", reason: "user asked" } })).status).toBe(422);
    expect((await call("DELETE", "/admin/users/staff-2", { token: "token-s", session, body: { confirmEmail: "Lead@Aevrin.net", reason: "x x x" } })).status).toBe(409);
    expect((await call("DELETE", "/admin/users/user-a", { token: "token-s", session, body: { confirmEmail: "A@example.com", reason: "user asked" } })).status).toBe(200);
    expect(auth.deleted).toEqual(["user-a"]);
    expect(db.table("projects").rows).toHaveLength(0);
    expect(db.table("payments").rows[0]).toMatchObject({ owner_id: null, customer_email: "a@example.com" });
    expect(db.table("admin_audit").rows.some((a) => a.action === "user.deleted" && a.target_email === "a@example.com")).toBe(true);
  });

  it("resets another admin's authenticator but not your own", async () => {
    await enroll("token-s2");
    expect((await admin("POST", "/admin/users/staff-1/reset-mfa", { reason: "lost phone" })).status).toBe(409);
    expect((await admin("POST", "/admin/users/staff-2/reset-mfa", { reason: "lost phone" })).status).toBe(200);
    expect((await json(await call("GET", "/admin/mfa/status", { token: "token-s2" }))).enrolled).toBe(false);
  });

  it("lists users, payments, audit, metrics, and traffic through the server functions", async () => {
    db.functions.admin_user_list = (_d, a) => ({ total: 1, users: [{ id: "user-a", email: "a@example.com", q: a.p_query }] });
    db.functions.admin_metrics = (_d, a) => ({ totals: { users: 5 }, days: a.p_days });
    db.functions.admin_traffic = (_d, a) => ({ views: 3, site: a.p_site, days: a.p_days });
    expect(await json(await admin("GET", "/admin/users?q=alice&page=0"))).toMatchObject({ total: 1, page: 0, users: [{ q: "alice" }] });
    expect(await json(await admin("GET", "/admin/metrics?days=7"))).toMatchObject({ days: 7 });
    expect(await json(await admin("GET", "/admin/traffic?days=9999&site=evil"))).toMatchObject({ days: 366, site: "" });
    expect((await json(await admin("GET", "/admin/audit"))).entries[0].action).toBe("admin.mfa_enrolled");
    expect((await admin("GET", "/admin/payments")).status).toBe(200);
  });
});

describe("page analytics (issue #45)", () => {
  const beacon = (body: unknown, headers: Record<string, string> = {}) =>
    call("POST", "/collect", {
      raw: JSON.stringify(body),
      headers: { "cf-connecting-ip": "203.0.113.9", "user-agent": "Mozilla/5.0 (iPhone; Mobile)", "cf-ipcountry": "IN", ...headers },
    });

  it("stores a cleaned path, the referrer host, and a daily hash, never the IP", async () => {
    const res = await beacon({ s: "dashboard", p: "/dashboard/campaigns/0f8fad5b-d9cb-469f-a165-70867728950e?tab=1#x", r: "https://www.google.com/search?q=secret" });
    expect(res.status).toBe(204);
    const [row] = db.table("page_views").rows;
    expect(row).toMatchObject({ site: "dashboard", path: "/dashboard/campaigns/:id", referrer: "google.com", country: "IN", device: "mobile", day: "2026-10-02" });
    expect(JSON.stringify(row)).not.toContain("203.0.113.9");
    expect(JSON.stringify(row)).not.toContain("secret");
    await beacon({ s: "landing", p: "/", r: "https://app.aevrin.net/dashboard/" });
    expect(db.table("page_views").rows[1].referrer).toBeNull();
    expect(db.table("page_views").rows[1].visitor).toBe(row.visitor); // same visitor, same day
    clock += 24 * 3600_000;
    await beacon({ s: "landing", p: "/", r: "" });
    expect(db.table("page_views").rows[2].visitor).not.toBe(row.visitor); // a new hash every day
  });

  it("does not count Do Not Track, Global Privacy Control, bots, bad bodies, or without a salt", async () => {
    await beacon({ s: "landing", p: "/" }, { dnt: "1" });
    await beacon({ s: "landing", p: "/" }, { "sec-gpc": "1" });
    await beacon({ s: "landing", p: "/" }, { "user-agent": "Googlebot/2.1" });
    await beacon({ s: "admin", p: "/" });
    await beacon({ s: "landing", p: "/", extra: 1 });
    app = createApp(deps({ analyticsSalt: undefined }));
    await beacon({ s: "landing", p: "/" });
    expect(db.table("page_views").rows).toHaveLength(0);
  });

  it("helpers", () => {
    expect(cleanPath("dashboard//x/12345/y")).toBe("/dashboard/x/:id/y");
    expect(referrerHost("javascript:alert(1)", "app.aevrin.net")).toBeNull();
    expect(deviceType("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceType("Mozilla/5.0 (Windows NT 10.0)")).toBe("desktop");
  });
});

describe("daily maintenance", () => {
  it("runs retention", async () => {
    db.functions.admin_maintenance = () => ({ page_views: 0 });
    expect(await runMaintenance(deps())).toMatchObject({ retention: { page_views: 0 }, reconciled: 0 });
  });
});
