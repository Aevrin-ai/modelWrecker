import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

/** The tables whose rows each belong to one account through `owner_id`. */
export type OwnedTable = "projects" | "targets" | "campaigns" | "runs" | "findings" | "devices";

// the reads every owned table shares; the owner filter backs up row-level security
export function ownedRowsRepository(db: Database, table: OwnedTable) {
  const rows = db.table(table);
  return namedQueries(table, {
    findForOwner: (id: string, owner: string): Promise<Row | null> => firstRow(rows.select({ eq: { id, owner_id: owner } })),
    listForOwner: (owner: string): Promise<Row[]> => rows.select({ eq: { owner_id: owner } }),
    searchForOwner: (owner: string, column: string, term: string, limit: number): Promise<Row[]> =>
      rows.select({ eq: { owner_id: owner }, ilike: { column, value: term }, limit }),
  });
}
