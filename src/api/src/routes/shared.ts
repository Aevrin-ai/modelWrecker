import type { Db } from "../db";

export const DEFAULT_PROJECT_NAME = "Default project";

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
