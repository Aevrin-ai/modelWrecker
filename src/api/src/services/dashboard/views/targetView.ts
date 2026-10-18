import type { Row } from "../../../types/deps";
import { SEVERITIES } from "../../../validators/schemas";
import { str } from "../../../lib/strings";
import { DAY_MS, byId, latest } from "../rows";
import type { World } from "../world";

// a target tested within this many days counts as active
const ACTIVE_DAYS = 7;

/** When a run of these campaigns last finished, or undefined when none has run. */
export function lastRunFor(world: World, campaignIds: Set<string>): string | undefined {
  const runs = world.runs.filter((run) => campaignIds.has(str(run.campaign_id)));
  return latest(runs.map((run) => str(run.completed_at ?? run.created_at)));
}

function targetStatus(isAuthorized: boolean, isRecent: boolean, lastTested: string | null): string {
  if (!isAuthorized) return "error";
  if (isRecent) return "active";
  if (lastTested) return "idle";
  return "ready";
}

/** A target row as the dashboard's Target type. */
export function mapTarget(target: Row, world: World, now: Date) {
  const id = str(target.id);
  const campaigns = world.campaigns.filter((campaign) => str(campaign.target_id) === id);
  const lastTested = lastRunFor(world, new Set(campaigns.map((campaign) => str(campaign.id)))) ?? null;
  const findings = world.findings.filter((finding) => str(finding.target_id) === id);
  const top = [...SEVERITIES].reverse().find((severity) => findings.some((finding) => finding.severity === severity)) ?? null;
  const isRecent = Boolean(lastTested && now.getTime() - new Date(lastTested).getTime() < ACTIVE_DAYS * DAY_MS);
  return {
    id,
    name: str(target.name),
    type: str(target.type) || "chat",
    provider: str(target.provider),
    endpoint: str(target.endpoint),
    model: str(target.model),
    status: targetStatus(Boolean(target.authorized), isRecent, lastTested),
    projectId: str(target.project_id),
    projectName: str(byId(world.projects).get(str(target.project_id))?.name),
    authorized: Boolean(target.authorized),
    capabilities: [],
    lastTestedAt: lastTested,
    campaignCount: campaigns.length,
    topSeverity: top,
    createdAt: str(target.created_at),
  };
}
