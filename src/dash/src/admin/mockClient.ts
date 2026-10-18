// admin demo data for mock mode: no network, no real accounts; any 6-digit code opens a session for the tab

import type {
  AdminClient,
  AdminUserRow,
  AuditEntry,
  Metrics,
  PaymentRow,
  Traffic,
  UserDetail,
} from "./adminTypes";

const DAY_MS = 86_400_000;
// a widely published demo authenticator secret, never a real one
const DEMO_TOTP_SECRET = "JBSWY3DPEHPK3PXP".repeat(2);
const DEMO_OTPAUTH_URI = `otpauth://totp/Aevrin%20Admin:ops%40aevrin.net?secret=${DEMO_TOTP_SECRET}&issuer=Aevrin%20Admin&algorithm=SHA1&digits=6&period=30`;

const ago = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
const wait = <T>(value: T, ms = 200) => new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));

let enrolled = false;
let session: string | null = null;

const users: AdminUserRow[] = [
  { id: "u-1", email: "priya@example.com", display_name: "Priya Sharma", created_at: ago(40), suspended_at: null, plan: "pro", effective_plan: "pro", current_period_end: ago(-18), credit_paise: 0, source: "payment", devices: 3, projects: 4, runs_month: 42, findings: 17, last_sign_in_at: ago(1), last_active: ago(0.2) },
  { id: "u-2", email: "dev@startup.example", display_name: "Arjun Mehta", created_at: ago(22), suspended_at: null, plan: "free", effective_plan: "free", current_period_end: null, credit_paise: 25000, source: "free", devices: 1, projects: 2, runs_month: 18, findings: 5, last_sign_in_at: ago(3), last_active: ago(2) },
  { id: "u-3", email: "secops@corp.example", display_name: "Corp SecOps", created_at: ago(90), suspended_at: null, plan: "enterprise", effective_plan: "enterprise", current_period_end: null, credit_paise: 0, source: "admin", devices: 14, projects: 31, runs_month: 210, findings: 96, last_sign_in_at: ago(0.5), last_active: ago(0.1) },
  { id: "u-4", email: "spam@bad.example", display_name: "Spam", created_at: ago(5), suspended_at: ago(2), plan: "free", effective_plan: "free", current_period_end: null, credit_paise: 0, source: "free", devices: 0, projects: 1, runs_month: 0, findings: 0, last_sign_in_at: ago(4), last_active: ago(4) },
];

const audit: AuditEntry[] = [
  { id: "a-2", adminEmail: "ops@aevrin.net", action: "user.suspended", targetUserId: "u-4", targetEmail: "spam@bad.example", reason: "Abuse report", detail: {}, createdAt: ago(2) },
  { id: "a-1", adminEmail: "ops@aevrin.net", action: "user.plan_changed", targetUserId: "u-3", targetEmail: "secops@corp.example", reason: "Signed contract", detail: { to: { plan: "enterprise" } }, createdAt: ago(30) },
];

const payments: PaymentRow[] = [
  { id: "p-2", number: "AEV-2026-000002", amount: 899, listPrice: 899, creditApplied: 0, refunded: 0, currency: "INR", status: "paid", plan: "pro", interval: "month", method: "upi", periodStart: ago(12), periodEnd: ago(-18), issuedAt: ago(12), orderId: "order_demo2", razorpayPaymentId: "pay_demo2", userId: "u-1", email: "priya@example.com", createdAt: ago(12) },
  { id: "p-1", number: "AEV-2026-000001", amount: 899, listPrice: 899, creditApplied: 0, refunded: 0, currency: "INR", status: "paid", plan: "pro", interval: "month", method: "card", periodStart: ago(42), periodEnd: ago(12), issuedAt: ago(42), orderId: "order_demo1", razorpayPaymentId: "pay_demo1", userId: "u-1", email: "priya@example.com", createdAt: ago(42) },
];

function detail(id: string): UserDetail {
  const row = users.find((candidate) => candidate.id === id) ?? users[0];
  const isPaid = row.effective_plan !== "free";
  return {
    id: row.id,
    email: row.email,
    name: row.display_name ?? "",
    createdAt: row.created_at,
    suspendedAt: row.suspended_at,
    suspendedReason: row.suspended_at ? "Abuse report" : null,
    isStaff: false,
    staffMfaEnrolled: false,
    account: { lastSignInAt: row.last_sign_in_at, bannedUntil: row.suspended_at ? "2126-01-01T00:00:00Z" : null, providers: ["google"] },
    subscription: {
      effectivePlan: row.effective_plan,
      storedPlan: row.effective_plan,
      lapsed: false,
      status: "active",
      source: row.source ?? "free",
      interval: row.effective_plan === "pro" ? "month" : null,
      paidUntil: row.current_period_end,
      creditPaise: row.credit_paise,
      bonus: { campaigns: 0, attacks: 0, devices: 0, projects: 0, expires_at: null },
      limits: isPaid ? { campaigns: 300, attacks: 100000, devices: 10, projects: 25 } : { campaigns: 20, attacks: 2000, devices: 1, projects: 2 },
      features: { advanced_strategies: isPaid, mcp: isPaid, analytics: isPaid, evidence_storage: isPaid, enterprise: row.effective_plan === "enterprise" },
    },
    usage: { campaigns: row.runs_month, attacks: row.runs_month * 31, devices: row.devices, projects: row.projects },
    usagePeriod: new Date().toISOString().slice(0, 7),
    payments: payments.filter((payment) => payment.userId === row.id),
    creditLedger: row.credit_paise ? [{ id: "l-1", deltaPaise: row.credit_paise, balancePaise: row.credit_paise, reason: "Beta feedback", actor: "admin:ops@aevrin.net", createdAt: ago(6) }] : [],
    devices: Array.from({ length: Math.min(row.devices, 3) }, (_, i) => ({ id: `d-${i}`, name: ["laptop", "ci-runner", "workstation"][i], os: "Linux 6.8", engineVersion: "0.0.3", lastSeenAt: ago(i), revoked: false, createdAt: ago(20 + i) })),
    projects: { total: row.projects, active: row.projects },
    settings: { sync: { detailedEvidence: isPaid, transcripts: false } },
    audit: audit.filter((entry) => entry.targetUserId === row.id),
  };
}

const series = (dayCount: number, valueAt: (i: number) => number) =>
  Array.from({ length: dayCount }, (_, i) => ({ date: new Date(Date.now() - (dayCount - 1 - i) * DAY_MS).toISOString().slice(0, 10), v: valueAt(i) }));

const done = () => wait(undefined);

export const mockAdminClient: AdminClient = {
  mfaStatus: () => wait({ email: "ops@aevrin.net", enrolled, locked: false }),
  enroll: () => wait({ secret: DEMO_TOTP_SECRET, otpauthUri: DEMO_OTPAUTH_URI }),
  async activate() {
    enrolled = true;
    session = "demo";
    return wait({ sessionToken: "demo", expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(), recoveryCodes: Array.from({ length: 10 }, (_, i) => `DEMO${i}-CODE${i}`) });
  },
  async verify() {
    session = "demo";
    return wait({ sessionToken: "demo", expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString() });
  },
  async endSession() {
    session = null;
  },
  hasSession: () => session !== null,
  users: (query, plan) => {
    const matches = users.filter(
      (row) =>
        (!query || `${row.email} ${row.display_name}`.toLowerCase().includes(query.toLowerCase())) &&
        (!plan || row.effective_plan === plan || (plan === "suspended" && row.suspended_at)),
    );
    return wait({ total: matches.length, users: matches, page: 0, pageSize: 50 });
  },
  user: (id) => wait(detail(id)),
  setPlan: done,
  setBonus: done,
  adjustCredit: done,
  refund: done,
  setSync: done,
  rename: done,
  revokeDevice: done,
  suspend: done,
  resetMfa: done,
  deleteUser: done,
  payments: () => wait({ page: 0, pageSize: 50, payments }),
  audit: () => wait({ page: 0, pageSize: 50, entries: audit }),
  metrics: (days) => {
    const dates = series(days, (i) => i);
    const metrics: Metrics = {
      totals: { users: 128, newUsers: 23, activeUsers: 41, suspended: 1, paying: 9, granted: 2, mrrPaise: 9 * 89900, revenuePaise: 11 * 89900, refundedPaise: 0, devices: 64, campaigns: 212, runs: 640, findings: 133 },
      planMix: { free: 117, pro: 10, enterprise: 1 },
      daily: dates.map((point, i) => ({ date: point.date, signups: (i * 7) % 3, runs: 10 + ((i * 13) % 17), revenuePaise: i % 9 === 0 ? 89900 : 0 })),
    };
    return wait(metrics);
  },
  traffic: (days) => {
    const dates = series(days, (i) => i);
    const traffic: Traffic = {
      views: 4210,
      visitors: 1630,
      daily: dates.map((point, i) => ({ date: point.date, views: 90 + ((i * 37) % 80), visitors: 35 + ((i * 17) % 30) })),
      pages: [
        { site: "landing", path: "/", views: 2400, visitors: 1200 },
        { site: "dashboard", path: "/dashboard/", views: 610, visitors: 140 },
        { site: "dashboard", path: "/dashboard/findings/:id", views: 380, visitors: 60 },
        { site: "dashboard", path: "/dashboard/billing", views: 120, visitors: 70 },
      ],
      referrers: [
        { referrer: "(direct)", views: 1900 },
        { referrer: "google.com", views: 1200 },
        { referrer: "github.com", views: 640 },
        { referrer: "news.ycombinator.com", views: 300 },
      ],
      countries: [
        { country: "IN", views: 2100 },
        { country: "US", views: 1100 },
        { country: "DE", views: 300 },
      ],
      devices: [
        { device: "desktop", views: 3300 },
        { device: "mobile", views: 840 },
        { device: "tablet", views: 70 },
      ],
    };
    return wait(traffic);
  },
};
