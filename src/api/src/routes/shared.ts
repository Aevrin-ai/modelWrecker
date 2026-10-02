import type { Db } from "../db";

export const DEFAULT_PROJECT_NAME = "Default project";

/** What an account allows to sync beyond metadata. Both default to off. */
export interface SyncPolicy {
  evidence: boolean;
  transcripts: boolean;
}

/** Read the account's sync settings (Settings -> What syncs to Aevrin). Missing or odd values mean off. */
export async function readSyncPolicy(db: Db, ownerId: string): Promise<SyncPolicy> {
  const [profile] = await db.table("profiles").select({ eq: { id: ownerId } });
  const sync = ((profile?.settings as { sync?: Record<string, unknown> } | undefined)?.sync ?? {}) as Record<
    string,
    unknown
  >;
  return { evidence: sync.detailedEvidence === true, transcripts: sync.transcripts === true };
}

/** The project a device lands in when the user approves it without choosing one. */
export async function ensureDefaultProject(db: Db, ownerId: string): Promise<string> {
  const projects = db.table("projects");
  const [existing] = await projects.select({ eq: { owner_id: ownerId, name: DEFAULT_PROJECT_NAME } });
  if (existing) return String(existing.id);
  const created = await projects.insert({
    owner_id: ownerId,
    name: DEFAULT_PROJECT_NAME,
    description: "Created automatically for devices linked without a project.",
  });
  return String(created.id);
}
