import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function profilesRepository(db: Database) {
  const profiles = db.table("profiles");
  return namedQueries("profiles", {
    findById: (id: string): Promise<Row | null> => firstRow(profiles.select({ eq: { id } })),
    listByIds: (ids: string[]): Promise<Row[]> => profiles.select({ in: { column: "id", values: ids } }),
    insert: (row: Row): Promise<Row> => profiles.insert(row),
    rename: (id: string, displayName: string): Promise<Row[]> => profiles.update({ id }, { display_name: displayName }),
    saveSettings: (id: string, settings: Row): Promise<Row[]> => profiles.update({ id }, { settings }),
    // a null time restores the account
    setSuspended: (id: string, suspendedAt: string | null, reason: string | null): Promise<Row[]> =>
      profiles.update({ id }, { suspended_at: suspendedAt, suspended_reason: reason }),
  });
}
