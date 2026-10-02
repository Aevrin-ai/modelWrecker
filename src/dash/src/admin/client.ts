/*
  Admin console API client (docs/security/admin.md).

  Every call carries the Supabase access token AND the admin session token (X-Admin-Session). The admin
  session is issued only after an authenticator code and lives in sessionStorage, so it ends when the tab
  closes. The server checks staff email, authenticator, and session on every request; nothing here is
  the control. A 401 `admin_session_required` drops the stored session so the code screen shows again.

  Mock mode (local preview) answers from a small in-memory dataset and never contacts anything.
*/

import { ApiError } from "@/api/httpClient";
import { API_BASE, IS_HTTP_MODE } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";
import { mockAdminClient } from "./mockClient";
import type { FeatureKey, MeterKey, Plan } from "@/types";

const SESSION_KEY = "aevrin-admin-session";
const TIMEOUT_MS = 20_000;

export interface MfaStatus {
  email: string;
  enrolled: boolean;
  locked: boolean;
}
export interface Enrollment {
  secret: string;
  otpauthUri: string;
}
export interface AdminSession {
  sessionToken: string;
  expiresAt: string;
  recoveryCodes?: string[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  suspended_at: string | null;
  plan: string;
  effective_plan: Plan["id"];
  current_period_end: string | null;
  credit_paise: number;
  source: string | null;
  devices: number;
  projects: number;
  runs_month: number;
  findings: number;
  last_sign_in_at: string | null;
  last_active: string | null;
}
export interface UserPage {
  total: number;
  users: AdminUserRow[];
  page: number;
  pageSize: number;
}

export interface AdminInvoice {
  id: string;
  number: string;
  amount: number;
  listPrice: number;
  creditApplied: number;
  refunded: number;
  currency: string;
  status: string;
  plan: string;
  interval: string;
  method: string;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
  orderId: string;
  razorpayPaymentId: string | null;
}

export interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  targetUserId: string | null;
  targetEmail: string | null;
  reason: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface UserDetail {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  isStaff: boolean;
  staffMfaEnrolled: boolean;
  account: { lastSignInAt: string | null; bannedUntil: string | null; providers: string[] } | null;
  subscription: {
    effectivePlan: Plan["id"];
    storedPlan: Plan["id"];
    lapsed: boolean;
    status: string;
    source: string;
    interval: string | null;
    paidUntil: string | null;
    creditPaise: number;
    bonus: Record<MeterKey, number> & { expires_at: string | null };
    limits: Record<MeterKey, number | null>;
    features: Record<FeatureKey, boolean>;
  };
  usage: Record<MeterKey, number>;
  usagePeriod: string;
  payments: AdminInvoice[];
  creditLedger: { id: string; deltaPaise: number; balancePaise: number; reason: string; actor: string; createdAt: string }[];
  devices: { id: string; name: string; os: string; engineVersion: string; lastSeenAt: string | null; revoked: boolean; createdAt: string }[];
  projects: { total: number; active: number };
  settings: { sync: { detailedEvidence: boolean; transcripts: boolean } };
  audit: AuditEntry[];
}

export interface PaymentRow extends AdminInvoice {
  userId: string | null;
  email: string;
  createdAt: string;
}

export interface Metrics {
  totals: {
    users: number;
    newUsers: number;
    activeUsers: number;
    suspended: number;
    paying: number;
    granted: number;
    mrrPaise: number;
    revenuePaise: number;
    refundedPaise: number;
    devices: number;
    campaigns: number;
    runs: number;
    findings: number;
  };
  planMix: Record<Plan["id"], number>;
  daily: { date: string; signups: number; runs: number; revenuePaise: number }[];
}

export interface Traffic {
  views: number;
  visitors: number;
  daily: { date: string; views: number; visitors: number }[];
  pages: { site: string; path: string; views: number; visitors: number }[];
  referrers: { referrer: string; views: number }[];
  countries: { country: string; views: number }[];
  devices: { device: string; views: number }[];
}

/** Thrown when the admin session is missing or over; the gate shows the code screen. */
export class AdminSessionRequired extends Error {}

function sessionEnded(message: string): never {
  storeSession(null);
  memorySession = null;
  window.dispatchEvent(new Event("aevrin-admin-session-ended"));
  throw new AdminSessionRequired(message);
}

export function storedSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
export function storeSession(token: string | null) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage blocked: the session lasts for this page only */
  }
}

let memorySession: string | null = null;
const currentSession = () => storedSession() ?? memorySession;

async function request<T>(method: string, path: string, body?: unknown, withSession = true): Promise<T> {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthorized", "Your session has ended. Please sign in again.");
  const session = withSession ? currentSession() : null;
  if (withSession && !session) sessionEnded("Enter your authenticator code.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(session ? { "X-Admin-Session": session } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "The control plane did not respond.");
  } finally {
    clearTimeout(timer);
  }
  const text = res.status === 204 ? "" : await res.text().catch(() => "");
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }
  if (!res.ok) {
    const code = typeof parsed.error === "string" ? parsed.error : `http_${res.status}`;
    const message = typeof parsed.message === "string" ? parsed.message.slice(0, 300) : "The request failed.";
    if (code === "admin_session_required") sessionEnded(message);
    throw new ApiError(res.status, code, message);
  }
  return parsed as T;
}

export interface AdminClient {
  mfaStatus(): Promise<MfaStatus>;
  enroll(): Promise<Enrollment>;
  activate(code: string): Promise<AdminSession>;
  verify(input: { code?: string; recoveryCode?: string }): Promise<AdminSession>;
  endSession(): Promise<void>;
  hasSession(): boolean;
  users(q: string, plan: string, page: number): Promise<UserPage>;
  user(id: string): Promise<UserDetail>;
  setPlan(id: string, plan: Plan["id"], paidUntil: string | null, reason: string): Promise<void>;
  setBonus(id: string, bonus: Record<MeterKey, number> & { expiresAt: string | null }, reason: string): Promise<void>;
  adjustCredit(id: string, deltaPaise: number, reason: string): Promise<void>;
  refund(id: string, paymentId: string, reason: string): Promise<void>;
  setSync(id: string, sync: { detailedEvidence: boolean; transcripts: boolean }, reason: string): Promise<void>;
  rename(id: string, displayName: string, reason: string): Promise<void>;
  revokeDevice(id: string, deviceId: string, reason: string): Promise<void>;
  suspend(id: string, suspended: boolean, reason: string): Promise<void>;
  resetMfa(id: string, reason: string): Promise<void>;
  deleteUser(id: string, confirmEmail: string, reason: string): Promise<void>;
  payments(page: number, status: string): Promise<{ page: number; pageSize: number; payments: PaymentRow[] }>;
  audit(page: number): Promise<{ page: number; pageSize: number; entries: AuditEntry[] }>;
  metrics(days: number): Promise<Metrics>;
  traffic(days: number, site: string): Promise<Traffic>;
}

const enc = encodeURIComponent;

class HttpAdminClient implements AdminClient {
  mfaStatus = () => request<MfaStatus>("GET", "/admin/mfa/status", undefined, false);
  enroll = () => request<Enrollment>("POST", "/admin/mfa/enroll", undefined, false);
  async activate(code: string) {
    const s = await request<AdminSession>("POST", "/admin/mfa/activate", { code }, false);
    this.keep(s);
    return s;
  }
  async verify(input: { code?: string; recoveryCode?: string }) {
    const s = await request<AdminSession>("POST", "/admin/mfa/verify", input, false);
    this.keep(s);
    return s;
  }
  private keep(s: AdminSession) {
    memorySession = s.sessionToken;
    storeSession(s.sessionToken);
  }
  async endSession() {
    try {
      await request<void>("POST", "/admin/session/end");
    } finally {
      memorySession = null;
      storeSession(null);
    }
  }
  hasSession = () => Boolean(currentSession());
  users = (q: string, plan: string, page: number) => request<UserPage>("GET", `/admin/users?q=${enc(q)}&plan=${enc(plan)}&page=${page}`);
  user = (id: string) => request<UserDetail>("GET", `/admin/users/${enc(id)}`);
  setPlan = (id: string, plan: Plan["id"], paidUntil: string | null, reason: string) =>
    request<void>("PATCH", `/admin/users/${enc(id)}/plan`, { plan, paidUntil, reason });
  setBonus = (id: string, bonus: Record<MeterKey, number> & { expiresAt: string | null }, reason: string) =>
    request<void>("POST", `/admin/users/${enc(id)}/bonus`, { ...bonus, reason });
  adjustCredit = (id: string, deltaPaise: number, reason: string) => request<void>("POST", `/admin/users/${enc(id)}/credit`, { deltaPaise, reason });
  refund = (id: string, paymentId: string, reason: string) =>
    request<void>("POST", `/admin/users/${enc(id)}/payments/${enc(paymentId)}/refund`, { reason });
  setSync = (id: string, sync: { detailedEvidence: boolean; transcripts: boolean }, reason: string) =>
    request<void>("PATCH", `/admin/users/${enc(id)}/settings`, { sync, reason });
  rename = (id: string, displayName: string, reason: string) => request<void>("PATCH", `/admin/users/${enc(id)}/profile`, { displayName, reason });
  revokeDevice = (id: string, deviceId: string, reason: string) =>
    request<void>("POST", `/admin/users/${enc(id)}/devices/${enc(deviceId)}/revoke`, { reason });
  suspend = (id: string, suspended: boolean, reason: string) => request<void>("POST", `/admin/users/${enc(id)}/suspend`, { suspended, reason });
  resetMfa = (id: string, reason: string) => request<void>("POST", `/admin/users/${enc(id)}/reset-mfa`, { reason });
  deleteUser = (id: string, confirmEmail: string, reason: string) => request<void>("DELETE", `/admin/users/${enc(id)}`, { confirmEmail, reason });
  payments = (page: number, status: string) =>
    request<{ page: number; pageSize: number; payments: PaymentRow[] }>("GET", `/admin/payments?page=${page}${status ? `&status=${enc(status)}` : ""}`);
  audit = (page: number) => request<{ page: number; pageSize: number; entries: AuditEntry[] }>("GET", `/admin/audit?page=${page}`);
  metrics = (days: number) => request<Metrics>("GET", `/admin/metrics?days=${days}`);
  traffic = (days: number, site: string) => request<Traffic>("GET", `/admin/traffic?days=${days}&site=${enc(site)}`);
}

export const adminClient: AdminClient = IS_HTTP_MODE ? new HttpAdminClient() : mockAdminClient;
