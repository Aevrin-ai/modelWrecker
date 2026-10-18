import type { AppContext } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { str } from "../../lib/strings";
import { analytics } from "../../services/dashboard/analytics";
import { planFor, queryParam, userScope } from "./context";
import { DAY_MS, ONLINE_WINDOW_MS, sumOf } from "../../services/dashboard/rows";
import { loadWorld, scope } from "../../services/dashboard/world";

// "runs this period" counts the last 30 days
const PERIOD_DAYS = 30;

export async function overview(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const world = scope(await loadWorld(db, owner), queryParam(c, "projectId"));
  const attempts = sumOf(world.runs, "attempts");
  const successes = sumOf(world.runs, "successful_attacks");
  const since = now.getTime() - PERIOD_DAYS * DAY_MS;
  const isOnline = (lastSeen: string) => now.getTime() - Date.parse(lastSeen) < ONLINE_WINDOW_MS;
  return c.json({
    totalCampaigns: world.campaigns.length,
    activeTargets: world.targets.filter((target) => target.authorized).length,
    totalFindings: world.findings.length,
    criticalFindings: world.findings.filter((finding) => finding.severity === "critical").length,
    successfulAttacks: successes,
    attackSuccessRate: attempts ? successes / attempts : 0,
    connectedDevices: world.devices.filter((device) => isOnline(str(device.last_seen_at ?? device.created_at))).length,
    runsThisPeriod: world.runs.filter((run) => Date.parse(str(run.created_at)) >= since).length,
    // period-over-period deltas need history the control plane does not keep yet
    deltas: {},
  });
}

export async function analyticsPage(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const summary = analytics(scope(await loadWorld(db, owner), queryParam(c, "projectId")));
  // the model leaderboard is a Pro feature; the rest of the page stays on every plan
  const { features } = await planFor(deps, owner, now);
  if (!features.analytics) return c.json({ ...summary, leaderboard: [], leaderboardLocked: true });
  return c.json({ ...summary, leaderboardLocked: false });
}
