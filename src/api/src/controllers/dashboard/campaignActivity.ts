import { routeParam, type AppContext } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { str } from "../../lib/strings";
import { campaignTotals } from "../../services/dashboard/views/campaignView";
import { findOwned, userScope } from "./context";
import { loadWorld } from "../../services/dashboard/world";
import { timelineEvents, strategyTotals, runTranscript } from "../../services/dashboard/views/activityView";
import { runsRepository } from "../../repositories/runs";

export async function campaignTimeline(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const campaign = await findOwned(db, "campaigns", routeParam(c, "id"), owner);
  return c.json(timelineEvents(campaign, await loadWorld(db, owner)));
}

export async function campaignStats(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const campaign = await findOwned(db, "campaigns", routeParam(c, "id"), owner);
  const { runs } = campaignTotals(campaign, await loadWorld(db, owner));
  return c.json({ campaignId: str(campaign.id), byStrategy: strategyTotals(runs) });
}

// runs synced without a transcript (sync off at the time) are listed with `synced: false`
export async function campaignTranscript(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const campaign = await findOwned(db, "campaigns", routeParam(c, "id"), owner);
  const runs = await runsRepository(db).listForCampaign(owner, str(campaign.id));
  runs.sort((first, second) => (str(first.started_at) < str(second.started_at) ? -1 : 1));
  const transcripts = [];
  for (const run of runs) transcripts.push(await runTranscript(db, owner, run));
  return c.json({ campaignId: str(campaign.id), runs: transcripts });
}
