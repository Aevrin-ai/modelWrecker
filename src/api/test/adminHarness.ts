// the app with staff and customer accounts, a fake Auth admin, and a fake Razorpay, for the admin console tests
import { expect } from "vitest";
import { totpAt } from "../src/services/admin/totp";
import { createApp } from "../src/app";
import type { AuthAccount, AuthAdmin, AuthUser, Deps } from "../src/types/deps";
import { MemoryDb } from "../src/database/memory";
import type { RazorpayApi } from "../src/services/razorpay/client";
import { callApi, readJson, type CallOptions, type TestApp } from "./harness";

export const USERS: Record<string, AuthUser> = {
  "token-s": { id: "staff-1", email: "ops@aevrin.net", name: "Ops", emailVerified: true },
  "token-s2": { id: "staff-2", email: "Lead@Aevrin.net", name: "Lead", emailVerified: true },
  "token-unverified": { id: "staff-3", email: "new@aevrin.net", name: "New", emailVerified: false },
  "token-a": { id: "user-a", email: "a@example.com", name: "Alice", emailVerified: true },
  "token-lookalike": { id: "user-l", email: "x@aevrin.net.evil.com", name: "X", emailVerified: true },
};
export const TOTP_KEY = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

export class FakeAuthAdmin implements AuthAdmin {
  banned = new Set<string>();
  deleted: string[] = [];
  constructor(private db: MemoryDb) {}
  async getUser(id: string): Promise<AuthAccount | null> {
    const profile = this.db.table("profiles").rows.find((row) => row.id === id);
    if (!profile) return null;
    const bannedUntil = this.banned.has(id) ? "2126-01-01" : null;
    return { id, email: String(profile.email), createdAt: null, lastSignInAt: null, bannedUntil, providers: ["google"] };
  }
  async setBanned(id: string, banned: boolean) {
    if (banned) this.banned.add(id);
    else this.banned.delete(id);
  }
  async deleteUser(id: string) {
    this.deleted.push(id);
    // ON DELETE CASCADE from auth.users -> profiles -> everything owned; payments are SET NULL
    for (const [name, table] of this.db.tables) {
      if (name === "payments") table.rows.forEach((row) => row.owner_id === id && (row.owner_id = null));
      else if (name === "profiles") table.rows = table.rows.filter((row) => row.id !== id);
      else if (name !== "admin_audit") table.rows = table.rows.filter((row) => row.owner_id !== id && row.user_id !== id);
    }
  }
}

export interface EnrolledStaff {
  secret: string;
  session: string;
  recovery: string[];
}

export class AdminHarness {
  db = new MemoryDb();
  clock = Date.parse("2026-10-02T10:00:00Z");
  auth = new FakeAuthAdmin(this.db);
  refunds: string[] = [];
  rzp: RazorpayApi = {
    createOrder: async () => ({ id: "order_X", amount: 0, currency: "INR", status: "created" }),
    fetchPayment: async () => {
      throw new Error("unused");
    },
    capturePayment: async () => {
      throw new Error("unused");
    },
    orderPayments: async () => [],
    refund: async (id) => {
      this.refunds.push(id);
      return { id: "rfnd_1", status: "processed", amount: 89900 };
    },
  };
  app: TestApp = createApp(this.deps());

  constructor() {
    for (const user of Object.values(USERS)) {
      this.db.table("profiles").rows.push({ id: user.id, email: user.email, display_name: user.name, created_at: "2026-09-01T00:00:00Z", settings: {} });
    }
  }

  deps(over: Partial<Deps> = {}): Deps {
    return {
      serviceDb: this.db,
      userDb: () => this.db,
      verifyUser: async (token) => USERS[token] ?? null,
      appOrigin: "https://app.aevrin.net",
      now: () => new Date(this.clock),
      authAdmin: this.auth,
      admin: { totpKey: TOTP_KEY },
      analyticsSalt: "salt",
      billing: { keyId: "rzp_test", keySecret: "s", webhookSecret: "w", api: this.rzp },
      ...over,
    };
  }

  call(method: string, path: string, opts: CallOptions = {}): Promise<Response> {
    return callApi(this.app, method, path, opts);
  }

  async callJson<T = Record<string, unknown>>(method: string, path: string, opts: CallOptions = {}): Promise<T> {
    return readJson<T>(await this.call(method, path, opts));
  }

  /** Enroll the staff member's authenticator and return the secret and an admin session token. */
  async enroll(token = "token-s"): Promise<EnrolledStaff> {
    const start = await this.callJson<{ secret: string }>("POST", "/admin/mfa/enroll", { token });
    const code = await totpAt(start.secret, this.clock);
    const res = await this.call("POST", "/admin/mfa/activate", { token, body: { code } });
    expect(res.status).toBe(200);
    const body = await readJson<{ sessionToken: string; recoveryCodes: string[] }>(res);
    return { secret: start.secret, session: body.sessionToken, recovery: body.recoveryCodes };
  }
}
