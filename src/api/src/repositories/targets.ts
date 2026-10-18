import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function targetsRepository(db: Database) {
  const targets = db.table("targets");
  return namedQueries("targets", {
    // a target name is unique within one project
    findByNameForOwner: (owner: string, projectId: string, name: string): Promise<Row | null> =>
      firstRow(targets.select({ eq: { owner_id: owner, project_id: projectId, name } })),
    insert: (row: Row): Promise<Row> => targets.insert(row),
  });
}
