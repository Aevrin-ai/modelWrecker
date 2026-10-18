import type { BillingConfig } from "../services/razorpay/client";
import type { EntitlementSigner } from "../services/entitlements/signing";

// the data-access seam: routes only talk to `Database`, so they run on Supabase and on the in-memory store alike

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
  select(query?: Query): Promise<Row[]>;
  insert(row: Row): Promise<Row>;
  update(eq: Record<string, unknown>, patch: Row): Promise<Row[]>;
  delete(eq: Record<string, unknown>): Promise<number>;
  /** Insert, or update the row that matches on the `onConflict` columns. */
  upsert(row: Row, onConflict: string[]): Promise<Row>;
  /** Count matching rows without reading them. */
  count(query?: Query): Promise<number>;
}

export interface Database {
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

/** The user a sign-in or refresh returns to the dashboard. Only what the dashboard shows. */
export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** A new access token and refresh token from Supabase Auth. */
export interface TokenGrant {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  user: SessionUser;
}

/** `invalid`: the code or refresh token is wrong, expired, revoked, or reused. `unavailable`: try later. */
export type GrantResult = { ok: true; grant: TokenGrant } | { ok: false; reason: "invalid" | "unavailable" };

/** Supabase Auth token calls, made by the API for the browser so the refresh token never reaches script. */
export interface AuthTokens {
  /** Finish the Google sign-in (PKCE): trade the one-time code and its verifier for tokens. */
  exchangeCode(code: string, verifier: string): Promise<GrantResult>;
  /** Rotate: the old refresh token stops working and a new one is returned. */
  refresh(refreshToken: string): Promise<GrantResult>;
  /** Revoke this session's refresh tokens. False when the access token was not accepted. */
  signOut(accessToken: string): Promise<boolean>;
}

/** Everything a request handler needs from the outside world. */
export interface Deps {
  /** Server-key access. Used only for device routes and device sign-in. */
  serviceDb: Database;
  /** Access as a signed-in user, so Postgres row-level security applies to every query. */
  userDb(accessToken: string): Database;
  /** Verify a Supabase access token. Returns null when it is invalid or expired. */
  verifyUser(accessToken: string): Promise<AuthUser | null>;
  appOrigin: string;
  /** Issuer in signed entitlements; stays app.aevrin.net so shipped engines keep trusting tokens (tests: appOrigin). */
  entitlementIssuer?: string;
  now(): Date;
  /** Razorpay checkout and webhooks. Billing routes answer 503 when it is not configured. */
  billing?: BillingConfig;
  /** Signs entitlements for devices. Devices get no entitlement (free baseline) when it is not configured. */
  signer?: EntitlementSigner;
  /** Dashboard sign-in tokens. The /auth routes answer 503 when it is not configured. */
  authTokens?: AuthTokens;
  /** Account administration for the admin console. */
  authAdmin?: AuthAdmin;
  /** Admin console secrets: the key that encrypts authenticator secrets at rest. */
  admin?: { totpKey: string };
  /** Secret mixed into the daily visitor hash for page analytics. Collection is off without it. */
  analyticsSalt?: string;
}
