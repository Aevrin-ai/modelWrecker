import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function campaignsRepository(db: Database) {
  const campaigns = db.table("campaigns");
  return namedQueries("campaigns", {
    // the engine's own campaign id, unique within one project
    findByExternalIdForOwner: (owner: string, projectId: string, externalId: string): Promise<Row | null> =>
      firstRow(campaigns.select({ eq: { owner_id: owner, project_id: projectId, external_id: externalId } })),
    insert: (row: Row): Promise<Row> => campaigns.insert(row),
    update: (id: string, patch: Row): Promise<Row | null> => firstRow(campaigns.update({ id }, patch)),
    renameForOwner: (id: string, owner: string, name: string): Promise<Row | null> =>
      firstRow(campaigns.update({ id, owner_id: owner }, { name })),
    // matches the old status too, so two concurrent moves cannot both succeed
    moveForOwner: (id: string, owner: string, from: string, to: string): Promise<Row | null> =>
      firstRow(campaigns.update({ id, owner_id: owner, status: from }, { status: to })),
    deleteForOwner: (id: string, owner: string): Promise<number> => campaigns.delete({ id, owner_id: owner }),
  });
}
