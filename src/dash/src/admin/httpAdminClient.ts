import type { MeterKey, Plan } from "@/types";
import type { AdminClient, AdminSession, AuditEntry, Enrollment, Metrics, MfaStatus, PaymentRow, Traffic, UserDetail, UserPage } from "./adminTypes";
import { adminRequest } from "./adminRequest";
import { clearSession, currentSession, keepSession } from "./adminSession";

const encodeId = encodeURIComponent;

type PaymentPage = { page: number; pageSize: number; payments: PaymentRow[] };
type AuditPage = { page: number; pageSize: number; entries: AuditEntry[] };

// the server checks staff email, authenticator, and session on every request (docs/security/admin.md)
export class HttpAdminClient implements AdminClient {
  mfaStatus = () => adminRequest<MfaStatus>("GET", "/admin/mfa/status", undefined, false);
  enroll = () => adminRequest<Enrollment>("POST", "/admin/mfa/enroll", undefined, false);
  async activate(code: string) {
    const session = await adminRequest<AdminSession>("POST", "/admin/mfa/activate", { code }, false);
    keepSession(session.sessionToken);
    return session;
  }
  async verify(input: { code?: string; recoveryCode?: string }) {
    const session = await adminRequest<AdminSession>("POST", "/admin/mfa/verify", input, false);
    keepSession(session.sessionToken);
    return session;
  }
  async endSession() {
    try {
      await adminRequest<void>("POST", "/admin/session/end");
    } finally {
      clearSession();
    }
  }
  hasSession = () => Boolean(currentSession());
  users = (query: string, plan: string, page: number) =>
    adminRequest<UserPage>("GET", `/admin/users?q=${encodeId(query)}&plan=${encodeId(plan)}&page=${page}`);
  user = (id: string) => adminRequest<UserDetail>("GET", `/admin/users/${encodeId(id)}`);
  setPlan = (id: string, plan: Plan["id"], paidUntil: string | null, reason: string) =>
    adminRequest<void>("PATCH", `/admin/users/${encodeId(id)}/plan`, { plan, paidUntil, reason });
  setBonus = (id: string, bonus: Record<MeterKey, number> & { expiresAt: string | null }, reason: string) =>
    adminRequest<void>("POST", `/admin/users/${encodeId(id)}/bonus`, { ...bonus, reason });
  adjustCredit = (id: string, deltaPaise: number, reason: string) =>
    adminRequest<void>("POST", `/admin/users/${encodeId(id)}/credit`, { deltaPaise, reason });
  refund = (id: string, paymentId: string, reason: string) =>
    adminRequest<void>("POST", `/admin/users/${encodeId(id)}/payments/${encodeId(paymentId)}/refund`, { reason });
  setSync = (id: string, sync: { detailedEvidence: boolean; transcripts: boolean }, reason: string) =>
    adminRequest<void>("PATCH", `/admin/users/${encodeId(id)}/settings`, { sync, reason });
  rename = (id: string, displayName: string, reason: string) =>
    adminRequest<void>("PATCH", `/admin/users/${encodeId(id)}/profile`, { displayName, reason });
  revokeDevice = (id: string, deviceId: string, reason: string) =>
    adminRequest<void>("POST", `/admin/users/${encodeId(id)}/devices/${encodeId(deviceId)}/revoke`, { reason });
  suspend = (id: string, suspended: boolean, reason: string) =>
    adminRequest<void>("POST", `/admin/users/${encodeId(id)}/suspend`, { suspended, reason });
  resetMfa = (id: string, reason: string) => adminRequest<void>("POST", `/admin/users/${encodeId(id)}/reset-mfa`, { reason });
  deleteUser = (id: string, confirmEmail: string, reason: string) =>
    adminRequest<void>("DELETE", `/admin/users/${encodeId(id)}`, { confirmEmail, reason });
  payments = (page: number, status: string) =>
    adminRequest<PaymentPage>("GET", `/admin/payments?page=${page}${status ? `&status=${encodeId(status)}` : ""}`);
  audit = (page: number) => adminRequest<AuditPage>("GET", `/admin/audit?page=${page}`);
  metrics = (days: number) => adminRequest<Metrics>("GET", `/admin/metrics?days=${days}`);
  traffic = (days: number, site: string) => adminRequest<Traffic>("GET", `/admin/traffic?days=${days}&site=${encodeId(site)}`);
}
