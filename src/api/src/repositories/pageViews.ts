import type { Database, Row } from "../types/deps";
import { namedQueries } from "../database/namedQueries";

export function pageViewsRepository(db: Database) {
  const views = db.table("page_views");
  return namedQueries("pageViews", {
    insert: (row: Row): Promise<Row> => views.insert(row),
  });
}
