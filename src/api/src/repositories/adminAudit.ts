import type { Database, Row } from "../types/deps";
import { namedQueries } from "../database/namedQueries";

const NEWEST_FIRST = { column: "created_at", ascending: false };

// append only: nothing here updates or deletes an audit entry
export function adminAuditRepository(db: Database) {
  const audit = db.table("admin_audit");
  return namedQueries("adminAudit", {
    insert: (row: Row): Promise<Row> => audit.insert(row),
    listNewestFirst: (limit: number, offset: number): Promise<Row[]> => audit.select({ order: NEWEST_FIRST, limit, offset }),
    listNewestForTarget: (userId: string, limit: number): Promise<Row[]> =>
      audit.select({ eq: { target_user_id: userId }, order: NEWEST_FIRST, limit }),
  });
}
