import type { Database, Row } from "../types/deps";
import { firstRow } from "../database/firstRow";
import { namedQueries } from "../database/namedQueries";

export function runTranscriptsRepository(db: Database) {
  const transcripts = db.table("run_transcripts");
  return namedQueries("runTranscripts", {
    findForRun: (runId: string, owner: string): Promise<Row | null> =>
      firstRow(transcripts.select({ eq: { run_id: runId, owner_id: owner } })),
    upsertForRun: (row: Row): Promise<Row> => transcripts.upsert(row, ["run_id"]),
    deleteForOwner: (owner: string): Promise<number> => transcripts.delete({ owner_id: owner }),
  });
}
