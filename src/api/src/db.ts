// The data-access seam. Route code only talks to `Db`, so the same routes run against Supabase in
// production and against an in-memory store in offline tests.

export type Row = Record<string, unknown>;

export interface Query {
  /** Exact-match filters. Always includes owner_id on user routes (defense in depth on top of RLS). */
  eq?: Record<string, unknown>;
  /** Case-insensitive substring match on one column. */
  ilike?: { column: string; value: string };
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

export interface Table {
  select(q?: Query): Promise<Row[]>;
  insert(row: Row): Promise<Row>;
  update(eq: Record<string, unknown>, patch: Row): Promise<Row[]>;
  delete(eq: Record<string, unknown>): Promise<number>;
  /** Insert, or update the row that matches on the `onConflict` columns. */
  upsert(row: Row, onConflict: string[]): Promise<Row>;
}

export interface Db {
  table(name: string): Table;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
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
}
