// In-memory Db for offline tests. Implements the same contract as the Supabase adapter, including
// unique-key upserts, so route behavior can be tested without a database.
import type { Db, Query, Row, Table } from "../db";

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

class MemoryTable implements Table {
  rows: Row[] = [];

  constructor(private uniques: string[][]) {}

  private matches(row: Row, eq: Record<string, unknown> = {}): boolean {
    return Object.entries(eq).every(([k, v]) => (row[k] ?? null) === v);
  }

  private checkUnique(row: Row, ignore?: Row): void {
    for (const cols of this.uniques) {
      if (cols.some((c) => row[c] == null)) continue; // NULLs never conflict, as in Postgres
      const clash = this.rows.find((r) => r !== ignore && cols.every((c) => r[c] === row[c]));
      if (clash) throw new Error(`duplicate key on ${cols.join(",")}`);
    }
  }

  async select(q: Query = {}): Promise<Row[]> {
    let out = this.rows.filter((r) => this.matches(r, q.eq));
    if (q.ilike) {
      const needle = q.ilike.value.toLowerCase();
      out = out.filter((r) => String(r[q.ilike!.column] ?? "").toLowerCase().includes(needle));
    }
    if (q.order) {
      const { column, ascending = true } = q.order;
      out = [...out].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
    }
    if (q.limit) out = out.slice(0, q.limit);
    return out.map((r) => ({ ...r }));
  }

  async insert(row: Row): Promise<Row> {
    const full = { id: uuid(), created_at: new Date().toISOString(), ...row };
    this.checkUnique(full);
    this.rows.push(full);
    return { ...full };
  }

  async update(eq: Record<string, unknown>, patch: Row): Promise<Row[]> {
    const hit = this.rows.filter((r) => this.matches(r, eq));
    for (const r of hit) {
      this.checkUnique({ ...r, ...patch }, r);
      Object.assign(r, patch);
    }
    return hit.map((r) => ({ ...r }));
  }

  async delete(eq: Record<string, unknown>): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !this.matches(r, eq));
    return before - this.rows.length;
  }

  async upsert(row: Row, onConflict: string[]): Promise<Row> {
    const existing = this.rows.find((r) => onConflict.every((c) => r[c] === row[c]));
    if (existing) {
      Object.assign(existing, row);
      return { ...existing };
    }
    return this.insert(row);
  }
}

// The unique keys from deploy/supabase/migrations, mirrored so tests catch duplicate-row bugs.
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
};

export class MemoryDb implements Db {
  tables = new Map<string, MemoryTable>();
  table(name: string): MemoryTable {
    let t = this.tables.get(name);
    if (!t) {
      t = new MemoryTable(UNIQUES[name] ?? []);
      this.tables.set(name, t);
    }
    return t;
  }
}
