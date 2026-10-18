import { routeParam, type AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps, Row } from "../../types/deps";
import { FindingPatch } from "../../validators/schemas";
import { str } from "../../lib/strings";
import { NOT_FOUND_MESSAGE, findOwned, queryParam, userScope } from "./context";
import { withEvidence } from "../../services/dashboard/views/evidenceView";
import { mapFinding } from "../../services/dashboard/views/findingView";
import { byId } from "../../services/dashboard/rows";
import { loadWorld, scope } from "../../services/dashboard/world";
import { findingEvidenceRepository } from "../../repositories/findingEvidence";
import { findingsRepository } from "../../repositories/findings";
import { ApiError } from "../../lib/errors";

export async function listFindings(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const world = await loadWorld(db, owner);
  const campaignId = queryParam(c, "campaignId");
  const targetId = queryParam(c, "targetId");
  const matches = (finding: Row) =>
    (!campaignId || str(finding.campaign_id) === campaignId) && (!targetId || str(finding.target_id) === targetId);
  const rows = scope(world, queryParam(c, "projectId")).findings.filter(matches);
  return c.json(rows.map((finding) => mapFinding(finding, world)));
}

export async function readFinding(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const finding = await findOwned(db, "findings", routeParam(c, "id"), owner);
  const world = await loadWorld(db, owner);
  const evidence = await findingEvidenceRepository(db).findForFinding(str(finding.id), owner);
  const run = byId(world.runs).get(str(finding.run_id));
  return c.json(withEvidence(mapFinding(finding, world), evidence, str(run?.external_id)));
}

export async function updateFindingStatus(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const body = await parseBody(c, FindingPatch);
  const id = routeParam(c, "id");
  await findOwned(db, "findings", id, owner);
  const finding = await findingsRepository(db).setStatusForOwner(id, owner, body.status);
  if (!finding) throw new ApiError(404, "not_found", NOT_FOUND_MESSAGE);
  return c.json(mapFinding(finding, await loadWorld(db, owner)));
}
