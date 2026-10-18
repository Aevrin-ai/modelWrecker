import type { Database } from "../../types/deps";
import { findingEvidenceRepository } from "../../repositories/findingEvidence";
import { findingsRepository } from "../../repositories/findings";
import { profilesRepository } from "../../repositories/profiles";
import { runTranscriptsRepository } from "../../repositories/runTranscripts";

const DEFAULT_SETTINGS = { sync: { metadata: true, detailedEvidence: false, transcripts: false }, notifications: {} };

type Settings = typeof DEFAULT_SETTINGS;

export async function readSettings(db: Database, owner: string) {
  const profile = await profilesRepository(db).findById(owner);
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
    await findingEvidenceRepository(db).deleteForOwner(owner);
    await findingsRepository(db).clearEvidenceFlagsForOwner(owner);
  }
  if (current.sync.transcripts && !next.sync.transcripts) {
    await runTranscriptsRepository(db).deleteForOwner(owner);
  }
}
