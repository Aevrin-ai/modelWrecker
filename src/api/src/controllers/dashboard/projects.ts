import { routeParam, type AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { ProjectCreate, ProjectPatch } from "../../validators/schemas";
import { findOwned, planFor, userScope } from "./context";
import { mapProject } from "../../services/dashboard/views/projectView";
import { loadWorld } from "../../services/dashboard/world";

export async function listProjects(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const world = await loadWorld(db, owner);
  return c.json(world.projects.map((project) => mapProject(project, world)));
}

export async function createProject(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const body = await parseBody(c, ProjectCreate);
  const { limits } = await planFor(deps, owner, now);
  const projects = await db.table("projects").select({ eq: { owner_id: owner } });
  const activeCount = projects.filter((project) => !project.archived).length;
  if (limits.projects !== null && activeCount >= limits.projects) {
    throw new ApiError(403, "plan_limit", `Your plan allows ${limits.projects} active projects. Archive one or upgrade.`);
  }
  const project = await db.table("projects").insert({ owner_id: owner, name: body.name, description: body.description });
  return c.json(mapProject(project, await loadWorld(db, owner)), 201);
}

export async function readProject(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const project = await findOwned(db, "projects", routeParam(c, "id"), owner);
  return c.json(mapProject(project, await loadWorld(db, owner)));
}

export async function updateProject(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const body = await parseBody(c, ProjectPatch);
  const id = routeParam(c, "id");
  await findOwned(db, "projects", id, owner);
  const [project] = await db.table("projects").update({ id, owner_id: owner }, { ...body, updated_at: new Date().toISOString() });
  return c.json(mapProject(project, await loadWorld(db, owner)));
}

export async function deleteProject(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const id = routeParam(c, "id");
  await findOwned(db, "projects", id, owner);
  await db.table("projects").delete({ id, owner_id: owner });
  return c.body(null, 204);
}
