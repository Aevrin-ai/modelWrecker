import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser, Database, Query, Row, Table } from "../types/deps";
import { DbError } from "../lib/errors";
import { supabaseAuthAdmin } from "../services/supabaseAuth/authAdmin";
import { supabaseAuthTokens } from "../services/supabaseAuth/authTokens";
import { NO_SESSION } from "./supabaseClient";

// existing imports of supabaseAuthTokens from this module keep working
export { supabaseAuthTokens } from "../services/supabaseAuth/authTokens";

/** The filter methods of a PostgREST query builder that `filtered` calls. Each returns the same builder. */
interface FilterBuilder {
  eq(column: string, value: never): FilterBuilder;
  is(column: string, value: null): FilterBuilder;
  ilike(column: string, pattern: string): FilterBuilder;
  in(column: string, values: never[]): FilterBuilder;
  gte(column: string, value: never): FilterBuilder;
  lt(column: string, value: never): FilterBuilder;
}

/** The Postgres or PostgREST code of a query error, so callers can tell "unavailable" from "wrong". */
const dbError = (error: { message: string; code?: string }) => new DbError(error.message, error.code ?? "");

class SupabaseTable implements Table {
  constructor(
    private client: SupabaseClient,
    private name: string,
  ) {}

  private filtered<Builder>(builder: Builder, query: Query): Builder {
    let request = builder as unknown as FilterBuilder;
    for (const [column, value] of Object.entries(query.eq ?? {})) {
      request = value === null ? request.is(column, null) : request.eq(column, value as never);
    }
    if (query.ilike) request = request.ilike(query.ilike.column, `%${query.ilike.value.replace(/[%_]/g, "")}%`);
    if (query.in) request = request.in(query.in.column, query.in.values as never[]);
    for (const [column, value] of Object.entries(query.gte ?? {})) request = request.gte(column, value as never);
    for (const [column, value] of Object.entries(query.lt ?? {})) request = request.lt(column, value as never);
    // every filter method returns the builder it was called on, so this is still the caller's builder type
    return request as unknown as Builder;
  }

  async select(query: Query = {}): Promise<Row[]> {
    if (query.in && query.in.values.length === 0) return [];
    let request = this.filtered(this.client.from(this.name).select("*"), query);
    if (query.order) request = request.order(query.order.column, { ascending: query.order.ascending ?? true });
    if (query.offset) request = request.range(query.offset, query.offset + (query.limit ?? 1000) - 1);
    else if (query.limit) request = request.limit(query.limit);
    const { data, error } = await request;
    if (error) throw dbError(error);
    return (data ?? []) as Row[];
  }

  async count(query: Query = {}): Promise<number> {
    if (query.in && query.in.values.length === 0) return 0;
    const request = this.filtered(this.client.from(this.name).select("*", { count: "exact", head: true }), query);
    const { count, error } = await request;
    if (error) throw dbError(error);
    return count ?? 0;
  }

  async insert(row: Row): Promise<Row> {
    const { data, error } = await this.client.from(this.name).insert(row).select("*").single();
    if (error) throw dbError(error);
    return data as Row;
  }

  async update(eq: Record<string, unknown>, patch: Row): Promise<Row[]> {
    let request = this.client.from(this.name).update(patch);
    for (const [column, value] of Object.entries(eq)) request = request.eq(column, value as never);
    const { data, error } = await request.select("*");
    if (error) throw dbError(error);
    return (data ?? []) as Row[];
  }

  async delete(eq: Record<string, unknown>): Promise<number> {
    let request = this.client.from(this.name).delete({ count: "exact" });
    for (const [column, value] of Object.entries(eq)) request = request.eq(column, value as never);
    const { count, error } = await request;
    if (error) throw dbError(error);
    return count ?? 0;
  }

  async upsert(row: Row, onConflict: string[]): Promise<Row> {
    const { data, error } = await this.client
      .from(this.name)
      .upsert(row, { onConflict: onConflict.join(",") })
      .select("*")
      .single();
    if (error) throw dbError(error);
    return data as Row;
  }
}

class SupabaseDatabase implements Database {
  constructor(private client: SupabaseClient) {}
  table(name: string): Table {
    return new SupabaseTable(this.client, name);
  }
  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw dbError(error);
    return data;
  }
}

async function verifySupabaseUser(service: SupabaseClient, accessToken: string): Promise<AuthUser | null> {
  const { data, error } = await service.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    name: (meta.full_name as string) ?? (meta.name as string) ?? null,
    emailVerified: Boolean(data.user.email_confirmed_at),
  };
}

export function supabaseDeps(env: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string }) {
  const service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, NO_SESSION);
  return {
    serviceDb: new SupabaseDatabase(service),
    userDb(accessToken: string): Database {
      // the anon key plus the user's own token: Postgres row-level security applies to every query
      const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        ...NO_SESSION,
        global: { ...NO_SESSION.global, headers: { Authorization: `Bearer ${accessToken}` } },
      });
      return new SupabaseDatabase(client);
    },
    verifyUser: (accessToken: string) => verifySupabaseUser(service, accessToken),
    authAdmin: supabaseAuthAdmin(service),
    authTokens: supabaseAuthTokens(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
  };
}
