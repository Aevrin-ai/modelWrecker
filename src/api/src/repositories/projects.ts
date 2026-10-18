import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function projectsRepository(db: Database) {
  const projects = db.table("projects");
  return namedQueries("projects", {
    findByNameForOwner: (owner: string, name: string): Promise<Row | null> =>
      firstRow(projects.select({ eq: { owner_id: owner, name } })),
    insert: (row: Row): Promise<Row> => projects.insert(row),
    updateForOwner: (id: string, owner: string, patch: Row): Promise<Row | null> =>
      firstRow(projects.update({ id, owner_id: owner }, patch)),
    deleteForOwner: (id: string, owner: string): Promise<number> => projects.delete({ id, owner_id: owner }),
  });
}
