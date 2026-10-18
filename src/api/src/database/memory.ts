// in-memory Database for offline tests, with the same contract as Supabase, unique-key upserts included
import type { Database, Query, Row, Table } from "../types/deps";
import { FUNCTIONS, memoryId, type MemoryFn } from "./memoryFunctions";

class MemoryTable implements Table {
  rows: Row[] = [];

  constructor(private uniques: string[][]) {}

  private matches(row: Row, eq: Record<string, unknown> = {}): boolean {
    return Object.entries(eq).every(([column, value]) => (row[column] ?? null) === value);
  }

  private checkUnique(row: Row, ignore?: Row): void {
    for (const columns of this.uniques) {
      // NULLs never conflict, as in Postgres
      if (columns.some((column) => row[column] == null)) continue;
      const clash = this.rows.find((other) => other !== ignore && columns.every((column) => other[column] === row[column]));
      if (clash) throw new Error(`duplicate key on ${columns.join(",")}`);
    }
  }

  private filter(query: Query): Row[] {
    let out = this.rows.filter((row) => this.matches(row, query.eq));
    const { ilike } = query;
    if (ilike) {
      const needle = ilike.value.toLowerCase();
      out = out.filter((row) => String(row[ilike.column] ?? "").toLowerCase().includes(needle));
    }
    if (query.in) {
      const { column, values } = query.in;
      out = out.filter((row) => values.includes(row[column]));
    }
    for (const [column, value] of Object.entries(query.gte ?? {})) {
      out = out.filter((row) => row[column] != null && String(row[column]) >= String(value));
    }
    for (const [column, value] of Object.entries(query.lt ?? {})) {
      out = out.filter((row) => row[column] != null && String(row[column]) < String(value));
    }
    return out;
  }

  async select(query: Query = {}): Promise<Row[]> {
    let out = this.filter(query);
    if (query.order) {
      const { column, ascending = true } = query.order;
      out = [...out].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
    }
    if (query.offset) out = out.slice(query.offset);
    if (query.limit) out = out.slice(0, query.limit);
    return out.map((row) => ({ ...row }));
  }

  async count(query: Query = {}): Promise<number> {
    return this.filter(query).length;
  }

  async insert(row: Row): Promise<Row> {
    const full = { id: memoryId(), created_at: new Date().toISOString(), ...row };
    this.checkUnique(full);
    this.rows.push(full);
    return { ...full };
  }

  async update(eq: Record<string, unknown>, patch: Row): Promise<Row[]> {
    const hits = this.rows.filter((row) => this.matches(row, eq));
    for (const row of hits) {
      this.checkUnique({ ...row, ...patch }, row);
      Object.assign(row, patch);
    }
    return hits.map((row) => ({ ...row }));
  }

  async delete(eq: Record<string, unknown>): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !this.matches(row, eq));
    return before - this.rows.length;
  }

  async upsert(row: Row, onConflict: string[]): Promise<Row> {
    const existing = this.rows.find((other) => onConflict.every((column) => other[column] === row[column]));
    if (existing) {
      Object.assign(existing, row);
      return { ...existing };
    }
    return this.insert(row);
  }
}

// the unique keys from deploy/supabase/migrations, mirrored so tests catch duplicate-row bugs
const UNIQUES: Record<string, string[][]> = {
  devices: [["credential_hash"]],
  device_auth_requests: [["device_code_hash"], ["user_code"]],
  campaigns: [["owner_id", "project_id", "external_id"]],
  runs: [["owner_id", "external_id"]],
  findings: [["owner_id", "external_id"]],
  targets: [["owner_id", "project_id", "name"]],
  subscriptions: [["owner_id"]],
  finding_evidence: [["finding_id"]],
  run_transcripts: [["run_id"]],
  payments: [["razorpay_order_id"], ["razorpay_payment_id"], ["invoice_number"]],
  billing_events: [["event_id"]],
  admin_mfa: [["user_id"]],
  admin_sessions: [["token_hash"]],
};

export class MemoryDb implements Database {
  tables = new Map<string, MemoryTable>();
  invoiceSeq = 0;
  /** Postgres function stand-ins. Tests may add or replace entries. */
  functions: Record<string, MemoryFn> = { ...FUNCTIONS };

  table(name: string): MemoryTable {
    let table = this.tables.get(name);
    if (!table) {
      table = new MemoryTable(UNIQUES[name] ?? []);
      this.tables.set(name, table);
    }
    return table;
  }

  async rpc(fn: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const impl = this.functions[fn];
    if (!impl) throw new Error(`no memory implementation for function ${fn}`);
    return structuredClone(impl(this, args));
  }
}
