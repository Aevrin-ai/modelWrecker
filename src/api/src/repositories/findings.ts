import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function findingsRepository(db: Database) {
  const findings = db.table("findings");
  return namedQueries("findings", {
    // keyed by the engine's finding id, so a re-sync updates the finding instead of adding a second one
    upsertByExternalId: (row: Row): Promise<Row> => findings.upsert(row, ["owner_id", "external_id"]),
    setStatusForOwner: (id: string, owner: string, status: string): Promise<Row | null> =>
      firstRow(findings.update({ id, owner_id: owner }, { status })),
    // after the account's evidence is deleted, no finding may still claim to have some
    clearEvidenceFlagsForOwner: (owner: string): Promise<Row[]> =>
      findings.update({ owner_id: owner, evidence_synced: true }, { evidence_synced: false }),
  });
}
