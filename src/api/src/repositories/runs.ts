import type { Database, Row } from "../types/deps";
import { namedQueries } from "../database/namedQueries";

export function runsRepository(db: Database) {
  const runs = db.table("runs");
  return namedQueries("runs", {
    listForCampaign: (owner: string, campaignId: string): Promise<Row[]> =>
      runs.select({ eq: { owner_id: owner, campaign_id: campaignId } }),
    listSinceForOwner: (owner: string, since: string): Promise<Row[]> =>
      runs.select({ eq: { owner_id: owner }, gte: { created_at: since } }),
    // keyed by the engine's run id, so a re-sync updates the run instead of adding a second one
    upsertByExternalId: (row: Row): Promise<Row> => runs.upsert(row, ["owner_id", "external_id"]),
  });
}
