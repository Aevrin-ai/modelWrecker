import { routeParam, type AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { CampaignCreate, NamePatch } from "../../validators/schemas";
import { str } from "../../lib/strings";
import { mapCampaign } from "../../services/dashboard/views/campaignView";
import { findOwned, queryParam, userScope } from "./context";
import { loadWorld, scope } from "../../services/dashboard/world";

export async function listCampaigns(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const world = await loadWorld(db, owner);
  const targetId = queryParam(c, "targetId");
  const campaigns = scope(world, queryParam(c, "projectId")).campaigns;
  const rows = campaigns.filter((campaign) => !targetId || str(campaign.target_id) === targetId);
  return c.json(rows.map((campaign) => mapCampaign(campaign, world)));
}

export async function createCampaign(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const body = await parseBody(c, CampaignCreate);
  await findOwned(db, "projects", body.projectId, owner);
  const target = await findOwned(db, "targets", body.targetId, owner);
  if (str(target.project_id) !== body.projectId) {
    throw new ApiError(422, "invalid_request", "targetId: the target belongs to another project");
  }
  if (!target.authorized) throw new ApiError(422, "invalid_request", "targetId: the target is not authorized for testing");
  const row = await db.table("campaigns").insert({
    owner_id: owner,
    project_id: body.projectId,
    target_id: body.targetId,
    name: body.name,
    status: "draft",
    strategies: body.strategies,
    objective_count: body.objectiveCount,
    stop_condition: body.stopCondition,
    concurrency: body.concurrency,
    max_attempts: body.maxAttempts,
  });
  return c.json(mapCampaign(row, await loadWorld(db, owner)), 201);
}

export async function readCampaign(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const row = await findOwned(db, "campaigns", routeParam(c, "id"), owner);
  return c.json(mapCampaign(row, await loadWorld(db, owner)));
}

export async function renameCampaign(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const body = await parseBody(c, NamePatch);
  const id = routeParam(c, "id");
  await findOwned(db, "campaigns", id, owner);
  const [row] = await db.table("campaigns").update({ id, owner_id: owner }, { name: body.name });
  return c.json(mapCampaign(row, await loadWorld(db, owner)));
}

export async function deleteCampaign(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const id = routeParam(c, "id");
  await findOwned(db, "campaigns", id, owner);
  await db.table("campaigns").delete({ id, owner_id: owner });
  return c.body(null, 204);
}

// the update matches the old status too, so two concurrent moves cannot both succeed
export async function moveCampaign(c: AppContext, deps: Deps, from: string, to: string): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const row = await findOwned(db, "campaigns", routeParam(c, "id"), owner);
  if (row.status !== from) throw new ApiError(409, "invalid_state", `Only a ${from} campaign can move to ${to}.`);
  const [next] = await db.table("campaigns").update({ id: row.id, owner_id: owner, status: from }, { status: to });
  if (!next) throw new ApiError(409, "invalid_state", "The campaign changed. Reload and try again.");
  return c.json(mapCampaign(next, await loadWorld(db, owner)));
}
