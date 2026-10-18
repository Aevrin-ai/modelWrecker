import type { Row } from "../../../types/deps";
import { str } from "../../../lib/strings";
import { byId, iso, num, sumOf } from "../rows";
import type { World } from "../world";

/** The runs of one campaign with their attempt and success totals. */
export function campaignTotals(campaign: Row, world: World) {
  const runs = world.runs.filter((run) => str(run.campaign_id) === str(campaign.id));
  return { runs, attempts: sumOf(runs, "attempts"), successes: sumOf(runs, "successful_attacks") };
}

function durationSeconds(started: string | null, completed: string | null): number | null {
  if (!started || !completed) return null;
  return Math.max(0, Math.round((Date.parse(completed) - Date.parse(started)) / 1000));
}

/** A campaign row as the dashboard's Campaign type. */
export function mapCampaign(campaign: Row, world: World) {
  const { attempts, successes } = campaignTotals(campaign, world);
  const started = iso(campaign.started_at);
  const completed = iso(campaign.completed_at);
  const target = byId(world.targets).get(str(campaign.target_id));
  const device = byId(world.devices).get(str(campaign.device_id));
  const maxAttempts = campaign.max_attempts == null ? null : num(campaign.max_attempts);
  return {
    id: str(campaign.id),
    name: str(campaign.name),
    status: str(campaign.status) || "draft",
    projectId: str(campaign.project_id),
    projectName: str(byId(world.projects).get(str(campaign.project_id))?.name),
    targetId: str(campaign.target_id),
    targetName: str(target?.name),
    deviceId: campaign.device_id ? str(campaign.device_id) : null,
    deviceName: device ? str(device.name) : null,
    objectiveCount: num(campaign.objective_count),
    strategies: (campaign.strategies as string[] | null) ?? [],
    stopCondition: str(campaign.stop_condition) || "complete",
    concurrency: num(campaign.concurrency) || 1,
    budget: { maxAttempts, maxTokens: null, maxSeconds: null, maxObjectives: null },
    startedAt: started,
    completedAt: completed,
    durationSeconds: durationSeconds(started, completed),
    attemptCount: attempts,
    successfulAttacks: successes,
    findingCount: world.findings.filter((finding) => str(finding.campaign_id) === str(campaign.id)).length,
    successRate: attempts ? successes / attempts : 0,
    createdAt: str(campaign.created_at),
  };
}
