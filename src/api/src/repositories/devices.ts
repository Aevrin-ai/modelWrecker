import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function devicesRepository(db: Database) {
  const devices = db.table("devices");
  return namedQueries("devices", {
    findByCredentialHash: (hash: string): Promise<Row | null> => firstRow(devices.select({ eq: { credential_hash: hash } })),
    listNewestForOwner: (owner: string): Promise<Row[]> =>
      devices.select({ eq: { owner_id: owner }, order: { column: "created_at", ascending: false } }),
    insert: (row: Row): Promise<Row> => devices.insert(row),
    recordSeen: (id: string, patch: { last_seen_at: string; engine_version?: string }): Promise<Row[]> =>
      devices.update({ id }, patch),
    renameForOwner: (id: string, owner: string, name: string): Promise<Row | null> =>
      firstRow(devices.update({ id, owner_id: owner }, { name })),
    // the token hash stays, flagged revoked, so the old token can never be accepted again
    revokeForOwner: (id: string, owner: string): Promise<Row | null> =>
      firstRow(devices.update({ id, owner_id: owner }, { revoked: true })),
  });
}
