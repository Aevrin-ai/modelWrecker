import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

// users can read their subscription but never write it, so writes go through the server key
export function subscriptionsRepository(db: Database) {
  const subscriptions = db.table("subscriptions");
  return namedQueries("subscriptions", {
    findForOwner: (owner: string): Promise<Row | null> => firstRow(subscriptions.select({ eq: { owner_id: owner } })),
    upsertForOwner: (owner: string, patch: Row): Promise<Row> => subscriptions.upsert({ owner_id: owner, ...patch }, ["owner_id"]),
    // the readiness check: one cheap read that proves the database answers
    probe: (): Promise<Row[]> => subscriptions.select({ limit: 1 }),
  });
}
