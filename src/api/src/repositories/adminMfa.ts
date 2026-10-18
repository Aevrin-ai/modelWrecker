import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

// one authenticator per staff account; the secret is stored encrypted
export function adminMfaRepository(db: Database) {
  const mfa = db.table("admin_mfa");
  return namedQueries("adminMfa", {
    findForUser: (userId: string): Promise<Row | null> => firstRow(mfa.select({ eq: { user_id: userId } })),
    upsertForUser: (row: Row): Promise<Row> => mfa.upsert(row, ["user_id"]),
    updateForUser: (userId: string, patch: Row): Promise<Row[]> => mfa.update({ user_id: userId }, patch),
    deleteForUser: (userId: string): Promise<number> => mfa.delete({ user_id: userId }),
  });
}
