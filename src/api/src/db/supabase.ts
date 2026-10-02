import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthAccount, AuthAdmin, AuthUser, Db, Query, Row, Table } from "../db";

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

class SupabaseTable implements Table {
  constructor(
    private client: SupabaseClient,
    private name: string,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private filtered(req: any, q: Query) {
    for (const [k, v] of Object.entries(q.eq ?? {})) req = v === null ? req.is(k, null) : req.eq(k, v as never);
    if (q.ilike) req = req.ilike(q.ilike.column, `%${q.ilike.value.replace(/[%_]/g, "")}%`);
    if (q.in) req = req.in(q.in.column, q.in.values as never[]);
    for (const [k, v] of Object.entries(q.gte ?? {})) req = req.gte(k, v as never);
    for (const [k, v] of Object.entries(q.lt ?? {})) req = req.lt(k, v as never);
    return req;
  }

  async select(q: Query = {}): Promise<Row[]> {
    if (q.in && q.in.values.length === 0) return [];
    let req = this.filtered(this.client.from(this.name).select("*"), q);
    if (q.order) req = req.order(q.order.column, { ascending: q.order.ascending ?? true });
    if (q.offset) req = req.range(q.offset, q.offset + (q.limit ?? 1000) - 1);
    else if (q.limit) req = req.limit(q.limit);
    const { data, error } = await req;
    if (error) throw new DbError(error.message);
    return (data ?? []) as Row[];
  }

  async count(q: Query = {}): Promise<number> {
    if (q.in && q.in.values.length === 0) return 0;
    const req = this.filtered(this.client.from(this.name).select("*", { count: "exact", head: true }), q);
    const { count, error } = await req;
    if (error) throw new DbError(error.message);
    return count ?? 0;
  }

  async insert(row: Row): Promise<Row> {
    const { data, error } = await this.client.from(this.name).insert(row).select("*").single();
    if (error) throw new DbError(error.message);
    return data as Row;
  }

  async update(eq: Record<string, unknown>, patch: Row): Promise<Row[]> {
    let req = this.client.from(this.name).update(patch);
    for (const [k, v] of Object.entries(eq)) req = req.eq(k, v as never);
    const { data, error } = await req.select("*");
    if (error) throw new DbError(error.message);
    return (data ?? []) as Row[];
  }

  async delete(eq: Record<string, unknown>): Promise<number> {
    let req = this.client.from(this.name).delete({ count: "exact" });
    for (const [k, v] of Object.entries(eq)) req = req.eq(k, v as never);
    const { count, error } = await req;
    if (error) throw new DbError(error.message);
    return count ?? 0;
  }

  async upsert(row: Row, onConflict: string[]): Promise<Row> {
    const { data, error } = await this.client
      .from(this.name)
      .upsert(row, { onConflict: onConflict.join(",") })
      .select("*")
      .single();
    if (error) throw new DbError(error.message);
    return data as Row;
  }
}

class SupabaseDb implements Db {
  constructor(private client: SupabaseClient) {}
  table(name: string): Table {
    return new SupabaseTable(this.client, name);
  }
  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new DbError(error.message);
    return data;
  }
}

/** A database error. The message is logged server-side only, never returned to the caller. */
export class DbError extends Error {}

export function supabaseDeps(env: {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}) {
  const service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, NO_SESSION);
  return {
    serviceDb: new SupabaseDb(service),
    userDb(accessToken: string): Db {
      // The anon key plus the user's own token: Postgres row-level security applies to every query.
      const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        ...NO_SESSION,
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      return new SupabaseDb(client);
    },
    async verifyUser(accessToken: string): Promise<AuthUser | null> {
      const { data, error } = await service.auth.getUser(accessToken);
      if (error || !data.user) return null;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        name: (meta.full_name as string) ?? (meta.name as string) ?? null,
        emailVerified: Boolean(data.user.email_confirmed_at),
      };
    },
    authAdmin: supabaseAuthAdmin(service),
  };
}

/** Supabase Auth admin calls, with the server key. Used only behind the admin console's checks. */
function supabaseAuthAdmin(service: SupabaseClient): AuthAdmin {
  return {
    async getUser(id: string): Promise<AuthAccount | null> {
      const { data, error } = await service.auth.admin.getUserById(id);
      if (error || !data.user) return null;
      const u = data.user as typeof data.user & { banned_until?: string | null };
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        bannedUntil: u.banned_until ?? null,
        providers: (u.identities ?? []).map((i) => i.provider),
      };
    },
    async setBanned(id: string, banned: boolean) {
      // About 100 years, which Supabase treats as a ban until it is lifted with "none".
      const { error } = await service.auth.admin.updateUserById(id, { ban_duration: banned ? "876000h" : "none" });
      if (error) throw new DbError(error.message);
    },
    async deleteUser(id: string) {
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) throw new DbError(error.message);
    },
  };
}
