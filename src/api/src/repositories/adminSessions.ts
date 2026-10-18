import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

// only the hash of a session token is stored
export function adminSessionsRepository(db: Database) {
  const sessions = db.table("admin_sessions");
  return namedQueries("adminSessions", {
    findByTokenHash: (hash: string): Promise<Row | null> => firstRow(sessions.select({ eq: { token_hash: hash } })),
    insert: (row: Row): Promise<Row> => sessions.insert(row),
    recordSeen: (id: string, seenAt: string): Promise<Row[]> => sessions.update({ id }, { last_seen_at: seenAt }),
    revoke: (id: string, revokedAt: string): Promise<Row[]> => sessions.update({ id }, { revoked_at: revokedAt }),
    revokeAllForUser: (userId: string, revokedAt: string): Promise<Row[]> =>
      sessions.update({ user_id: userId }, { revoked_at: revokedAt }),
  });
}
