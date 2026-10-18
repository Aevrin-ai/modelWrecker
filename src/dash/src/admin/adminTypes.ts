import type { FeatureKey, MeterKey, Plan } from "@/types";

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

export interface AdminClient {
  mfaStatus(): Promise<MfaStatus>;
  enroll(): Promise<Enrollment>;
  activate(code: string): Promise<AdminSession>;
  verify(input: { code?: string; recoveryCode?: string }): Promise<AdminSession>;
  endSession(): Promise<void>;
  hasSession(): boolean;
  users(query: string, plan: string, page: number): Promise<UserPage>;
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
