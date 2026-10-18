// admin console user management, offline: every change is checked, applied, and audited with its reason
import { beforeEach, describe, expect, it } from "vitest";
import { AdminHarness } from "./adminHarness";
import { readJson } from "./harness";

interface UserDetailBody {
  subscription: { limits: { campaigns: number } };
  creditLedger: unknown[];
  audit: { action: string }[];
}

let harness: AdminHarness;
let session: string;

beforeEach(async () => {
  harness = new AdminHarness();
  session = (await harness.enroll()).session;
});

const asAdmin = (method: string, path: string, body?: unknown) => harness.call(method, path, { token: "token-s", session, body });

describe("user management (issue #44)", () => {
  it("changes a plan, sets a bonus and credit, and audits each with its reason", async () => {
    expect((await asAdmin("PATCH", "/admin/users/user-a/plan", { plan: "pro", paidUntil: "2027-01-01T00:00:00Z" })).status).toBe(422);
    expect((await asAdmin("PATCH", "/admin/users/user-a/plan", { plan: "pro", paidUntil: "2027-01-01T00:00:00Z", reason: "launch partner" })).status).toBe(200);
    expect((await asAdmin("POST", "/admin/users/user-a/bonus", { campaigns: 50, attacks: 5000, devices: 0, projects: 2, expiresAt: null, reason: "beta tester" })).status).toBe(200);
    const credit = await readJson<{ balancePaise: number }>(await asAdmin("POST", "/admin/users/user-a/credit", { deltaPaise: 50000, reason: "outage goodwill" }));
    expect(credit.balancePaise).toBe(50000);

    const detail = await readJson<UserDetailBody>(await asAdmin("GET", "/admin/users/user-a"));
    expect(detail.subscription).toMatchObject({ effectivePlan: "pro", source: "admin", creditPaise: 50000 });
    expect(detail.subscription.limits.campaigns).toBe(350);
    expect(detail.creditLedger[0]).toMatchObject({ deltaPaise: 50000, actor: "admin:ops@aevrin.net" });
    expect(detail.audit.map((entry) => entry.action)).toEqual(["user.credit_adjusted", "user.bonus_set", "user.plan_changed"]);
    expect(detail.audit[2]).toMatchObject({ adminEmail: "ops@aevrin.net", targetEmail: "a@example.com", reason: "launch partner" });

    // the user's own API now reflects it
    const subscription = await harness.callJson("GET", "/subscription", { token: "token-a" });
    expect(subscription).toMatchObject({ planId: "pro", source: "admin", creditPaise: 50000 });
  });

  it("refunds a paid purchase through Razorpay and takes back its time", async () => {
    harness.db.table("subscriptions").rows.push({ owner_id: "user-a", plan: "pro", status: "active", source: "payment", current_period_end: "2026-11-02T10:00:00.000Z", credit_paise: 0, bonus: {} });
    harness.db.table("payments").rows.push({
      id: "pay-row-1", owner_id: "user-a", razorpay_order_id: "order_A", razorpay_payment_id: "pay_A", plan: "pro", billing_interval: "month", months: 1,
      list_price_paise: 89900, credit_applied_paise: 0, amount_paise: 89900, amount_refunded_paise: 0, currency: "INR", status: "paid", invoice_number: "AEV-2026-000001", created_at: "2026-10-02T10:00:00Z",
    });
    expect((await asAdmin("POST", "/admin/users/user-a/payments/pay-row-1/refund", { reason: "asked within 7 days" })).status).toBe(200);
    expect(harness.refunds).toEqual(["pay_A"]);
    expect(harness.db.table("payments").rows[0].status).toBe("refunded");
    expect((await harness.callJson<{ planId: string }>("GET", "/subscription", { token: "token-a" })).planId).toBe("free");
  });

  it("revokes a device and changes sync settings", async () => {
    harness.db.table("devices").rows.push({ id: "dev-1", owner_id: "user-a", name: "laptop", revoked: false, credential_hash: "h" });
    harness.db.table("finding_evidence").rows.push({ finding_id: "f", owner_id: "user-a" });
    expect((await asAdmin("POST", "/admin/users/user-a/devices/dev-1/revoke", { reason: "lost laptop" })).status).toBe(200);
    expect(harness.db.table("devices").rows[0].revoked).toBe(true);
    expect((await asAdmin("PATCH", "/admin/users/user-a/settings", { sync: { detailedEvidence: false, transcripts: false }, reason: "user request" })).status).toBe(200);
    expect(harness.db.table("finding_evidence").rows).toHaveLength(0);
  });

  it("suspends and restores an account, blocking its API and sign-in", async () => {
    expect((await asAdmin("POST", "/admin/users/user-a/suspend", { suspended: true, reason: "abuse report" })).status).toBe(200);
    expect(harness.auth.banned.has("user-a")).toBe(true);
    const blocked = await harness.call("GET", "/me", { token: "token-a" });
    expect(blocked.status).toBe(403);
    expect((await readJson<{ error: string }>(blocked)).error).toBe("account_suspended");
    expect((await asAdmin("POST", "/admin/users/user-a/suspend", { suspended: false, reason: "resolved" })).status).toBe(200);
    expect((await harness.call("GET", "/me", { token: "token-a" })).status).toBe(200);
    expect((await asAdmin("POST", "/admin/users/staff-1/suspend", { suspended: true, reason: "oops" })).status).toBe(409);
  });

  it("deletes a user only with the email typed, keeps their payments, and never deletes staff", async () => {
    harness.db.table("payments").rows.push({ id: "p1", owner_id: "user-a", razorpay_order_id: "order_B", status: "paid", amount_paise: 89900 });
    harness.db.table("projects").rows.push({ id: "pr1", owner_id: "user-a", name: "x" });
    const remove = (path: string, body: unknown) => harness.call("DELETE", path, { token: "token-s", session, body });
    expect((await remove("/admin/users/user-a", { confirmEmail: "wrong@example.com", reason: "user asked" })).status).toBe(422);
    expect((await remove("/admin/users/staff-2", { confirmEmail: "Lead@Aevrin.net", reason: "x x x" })).status).toBe(409);
    expect((await remove("/admin/users/user-a", { confirmEmail: "A@example.com", reason: "user asked" })).status).toBe(200);
    expect(harness.auth.deleted).toEqual(["user-a"]);
    expect(harness.db.table("projects").rows).toHaveLength(0);
    expect(harness.db.table("payments").rows[0]).toMatchObject({ owner_id: null, customer_email: "a@example.com" });
    expect(harness.db.table("admin_audit").rows.some((entry) => entry.action === "user.deleted" && entry.target_email === "a@example.com")).toBe(true);
  });

  it("resets another admin's authenticator but not your own", async () => {
    await harness.enroll("token-s2");
    expect((await asAdmin("POST", "/admin/users/staff-1/reset-mfa", { reason: "lost phone" })).status).toBe(409);
    expect((await asAdmin("POST", "/admin/users/staff-2/reset-mfa", { reason: "lost phone" })).status).toBe(200);
    expect((await harness.callJson<{ enrolled: boolean }>("GET", "/admin/mfa/status", { token: "token-s2" })).enrolled).toBe(false);
  });

  it("lists users, payments, audit, metrics, and traffic through the server functions", async () => {
    harness.db.functions.admin_user_list = (_db, args) => ({ total: 1, users: [{ id: "user-a", email: "a@example.com", q: args.p_query }] });
    harness.db.functions.admin_metrics = (_db, args) => ({ totals: { users: 5 }, days: args.p_days });
    harness.db.functions.admin_traffic = (_db, args) => ({ views: 3, site: args.p_site, days: args.p_days });
    expect(await readJson(await asAdmin("GET", "/admin/users?q=alice&page=0"))).toMatchObject({ total: 1, page: 0, users: [{ q: "alice" }] });
    expect(await readJson(await asAdmin("GET", "/admin/metrics?days=7"))).toMatchObject({ days: 7 });
    expect(await readJson(await asAdmin("GET", "/admin/traffic?days=9999&site=evil"))).toMatchObject({ days: 366, site: "" });
    expect((await readJson<{ entries: { action: string }[] }>(await asAdmin("GET", "/admin/audit"))).entries[0].action).toBe("admin.mfa_enrolled");
    expect((await asAdmin("GET", "/admin/payments")).status).toBe(200);
  });
});
