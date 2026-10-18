import type { Database } from "../types/deps";
import { projectsRepository } from "../repositories/projects";

const DEFAULT_PROJECT_NAME = "Default project";

/** The project a device lands in when the user approves it without choosing one. */
export async function ensureDefaultProject(db: Database, ownerId: string): Promise<string> {
  const projects = projectsRepository(db);
  const existing = await projects.findByNameForOwner(ownerId, DEFAULT_PROJECT_NAME);
  if (existing) return String(existing.id);
  const created = await projects.insert({
    owner_id: ownerId,
    name: DEFAULT_PROJECT_NAME,
    description: "Created automatically for devices linked without a project.",
  });
  return String(created.id);
}
