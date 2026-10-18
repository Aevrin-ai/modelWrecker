import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function findingEvidenceRepository(db: Database) {
  const evidence = db.table("finding_evidence");
  return namedQueries("findingEvidence", {
    findForFinding: (findingId: string, owner: string): Promise<Row | null> =>
      firstRow(evidence.select({ eq: { finding_id: findingId, owner_id: owner } })),
    upsertForFinding: (row: Row): Promise<Row> => evidence.upsert(row, ["finding_id"]),
    deleteForOwner: (owner: string): Promise<number> => evidence.delete({ owner_id: owner }),
  });
}
