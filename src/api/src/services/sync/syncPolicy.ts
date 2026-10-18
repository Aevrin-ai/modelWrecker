import type { Database } from "../../types/deps";
import { effectivePlan } from "../billing/plans";

/** What an account allows to sync beyond metadata. Both default to off. */
export interface SyncPolicy {
  evidence: boolean;
  transcripts: boolean;
}

/**
 * Read the account's sync settings (Settings -> What syncs to Aevrin). Missing or odd values mean off.
 * Detail is a Pro feature: on a plan without evidence storage both are off, whatever the settings say.
 */
export async function readSyncPolicy(db: Database, ownerId: string, now: Date = new Date()): Promise<SyncPolicy> {
  const [[profile], [sub]] = await Promise.all([
    db.table("profiles").select({ eq: { id: ownerId } }),
    db.table("subscriptions").select({ eq: { owner_id: ownerId } }),
  ]);
  if (!effectivePlan(sub, now).features.evidence_storage) return { evidence: false, transcripts: false };
  const sync = ((profile?.settings as { sync?: Record<string, unknown> } | undefined)?.sync ?? {}) as Record<
    string,
    unknown
  >;
  return { evidence: sync.detailedEvidence === true, transcripts: sync.transcripts === true };
}
