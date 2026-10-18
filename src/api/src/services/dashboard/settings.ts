import type { Database } from "../../types/deps";

const DEFAULT_SETTINGS = { sync: { metadata: true, detailedEvidence: false, transcripts: false }, notifications: {} };

type Settings = typeof DEFAULT_SETTINGS;

export async function readSettings(db: Database, owner: string) {
  const [profile] = await db.table("profiles").select({ eq: { id: owner } });
  const stored = (profile?.settings as Settings | undefined) ?? DEFAULT_SETTINGS;
  return { sync: { ...DEFAULT_SETTINGS.sync, ...stored.sync, metadata: true }, notifications: { ...stored.notifications } };
}

export function isTurningDetailOn(current: Settings, sync: { detailedEvidence?: boolean; transcripts?: boolean } | undefined): boolean {
  const evidenceOn = sync?.detailedEvidence === true && !current.sync.detailedEvidence;
  const transcriptsOn = sync?.transcripts === true && !current.sync.transcripts;
  return evidenceOn || transcriptsOn;
}

// the local runs folder keeps the originals, and turning detail back on re-sends them on the next sync
export async function deleteDetailTurnedOff(db: Database, owner: string, current: Settings, next: Settings): Promise<void> {
  if (current.sync.detailedEvidence && !next.sync.detailedEvidence) {
    await db.table("finding_evidence").delete({ owner_id: owner });
    await db.table("findings").update({ owner_id: owner, evidence_synced: true }, { evidence_synced: false });
  }
  if (current.sync.transcripts && !next.sync.transcripts) {
    await db.table("run_transcripts").delete({ owner_id: owner });
  }
}
