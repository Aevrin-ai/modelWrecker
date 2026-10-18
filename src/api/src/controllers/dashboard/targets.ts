import { routeParam, type AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { displayEndpoint } from "../../lib/endpoint";
import { TargetCreate } from "../../validators/schemas";
import { findOwned, queryParam, userScope } from "./context";
import { mapTarget } from "../../services/dashboard/views/targetView";
import { loadWorld, scope } from "../../services/dashboard/world";
import { targetsRepository } from "../../repositories/targets";

export async function listTargets(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const world = await loadWorld(db, owner);
  const projectWorld = scope(world, queryParam(c, "projectId"));
  return c.json(projectWorld.targets.map((target) => mapTarget(target, world, now)));
}

export async function createTarget(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const body = await parseBody(c, TargetCreate);
  await findOwned(db, "projects", body.projectId, owner);
  const targets = targetsRepository(db);
  const duplicate = await targets.findByNameForOwner(owner, body.projectId, body.name);
  if (duplicate) throw new ApiError(409, "duplicate", "A target with that name already exists in this project.");
  const target = await targets.insert({
    owner_id: owner,
    project_id: body.projectId,
    name: body.name,
    type: body.type,
    provider: body.provider,
    endpoint: displayEndpoint(body.endpoint),
    model: body.model,
    authorized: true,
  });
  return c.json(mapTarget(target, await loadWorld(db, owner), now), 201);
}

export async function readTarget(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const target = await findOwned(db, "targets", routeParam(c, "id"), owner);
  return c.json(mapTarget(target, await loadWorld(db, owner), now));
}
