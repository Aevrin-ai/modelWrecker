import type { BillingConfig } from "./razorpay";
import type { EntitlementSigner } from "./entitlements";

// The data-access seam. Route code only talks to `Db`, so the same routes run against Supabase in
// production and against an in-memory store in offline tests.

export type Row = Record<string, unknown>;

export interface Query {
  /** Exact-match filters. Always includes owner_id on user routes (defense in depth on top of RLS). */
  eq?: Record<string, unknown>;
  /** Case-insensitive substring match on one column. */
  ilike?: { column: string; value: string };
  /** The column's value is one of these. An empty list matches nothing. */
  in?: { column: string; values: unknown[] };
  /** Range filters on one column each: `gte` is inclusive, `lt` is exclusive. */
  gte?: Record<string, unknown>;
  lt?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
  /** Skip this many rows (with `order` and `limit`, for paging). */
  offset?: number;
}

export interface Table {
  select(q?: Query): Promise<Row[]>;
  insert(row: Row): Promise<Row>;
  update(eq: Record<string, unknown>, patch: Row): Promise<Row[]>;
  delete(eq: Record<string, unknown>): Promise<number>;
  /** Insert, or update the row that matches on the `onConflict` columns. */
  upsert(row: Row, onConflict: string[]): Promise<Row>;
  /** Count matching rows without reading them. */
  count(q?: Query): Promise<number>;
}

export interface Db {
  table(name: string): Table;
  /** Call a Postgres function (deploy/supabase/migrations). Used for counters and admin aggregates. */
  rpc(fn: string, args?: Record<string, unknown>): Promise<unknown>;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  /** True when the sign-in provider confirmed the email address. Admin access requires it. */
  emailVerified?: boolean;
}

/** Server-side account administration (Supabase Auth admin API). Used only by admin routes. */
export interface AuthAdmin {
  getUser(id: string): Promise<AuthAccount | null>;
  /** Block or allow sign-in. A blocked user's existing sessions stop at their next refresh. */
  setBanned(id: string, banned: boolean): Promise<void>;
  /** Delete the account. Every row the user owns is removed by ON DELETE CASCADE. */
  deleteUser(id: string): Promise<void>;
}

export interface AuthAccount {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  providers: string[];
}

/** Everything a request handler needs from the outside world. */
export interface Deps {
  /** Server-key access. Used only for device routes and device sign-in. */
  serviceDb: Db;
  /** Access as a signed-in user, so Postgres row-level security applies to every query. */
  userDb(accessToken: string): Db;
  /** Verify a Supabase access token. Returns null when it is invalid or expired. */
  verifyUser(accessToken: string): Promise<AuthUser | null>;
  appOrigin: string;
  now(): Date;
  /** Razorpay checkout and webhooks. Billing routes answer 503 when it is not configured. */
  billing?: BillingConfig;
  /** Signs entitlements for devices. Devices get no entitlement (free baseline) when it is not configured. */
  signer?: EntitlementSigner;
  /** Account administration for the admin console. */
  authAdmin?: AuthAdmin;
  /** Admin console secrets: the key that encrypts authenticator secrets at rest. */
  admin?: { totpKey: string };
  /** Secret mixed into the daily visitor hash for page analytics. Collection is off without it. */
  analyticsSalt?: string;
}
