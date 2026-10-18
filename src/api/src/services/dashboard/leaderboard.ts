import type { Row } from "../../types/deps";
import { wilson } from "../../lib/wilson";
import { str } from "../../lib/strings";
import { sumOf } from "./rows";
import type { World } from "./world";

function newestRun(runs: Row[]): Row | undefined {
  const startedAt = (run: Row) => str(run.started_at ?? run.created_at);
  return [...runs].sort((first, second) => (startedAt(first) < startedAt(second) ? 1 : -1))[0];
}

function leaderboardRow(target: Row, world: World) {
  const campaignIds = new Set(
    world.campaigns.filter((campaign) => str(campaign.target_id) === str(target.id)).map((campaign) => str(campaign.id)),
  );
  const runs = world.runs.filter((run) => campaignIds.has(str(run.campaign_id)));
  const attempts = sumOf(runs, "attempts");
  const successes = sumOf(runs, "successful_attacks");
  const findings = world.findings.filter((finding) => str(finding.target_id) === str(target.id));
  const [ciLow, ciHigh] = wilson(successes, attempts);
  const newest = newestRun(runs);
  return {
    targetId: str(target.id),
    targetName: str(target.name),
    asr: attempts ? successes / attempts : 0,
    ciLow,
    ciHigh,
    attempts,
    successes,
    refusals: sumOf(runs, "refusals"),
    findings: findings.length,
    highCritical: findings.filter((finding) => finding.severity === "high" || finding.severity === "critical").length,
    latestCampaignId: newest ? str(newest.campaign_id) : null,
  };
}

/** Attack success per target that has been tested, with how many attacks worked and were refused. */
export function leaderboard(world: World) {
  return world.targets.map((target) => leaderboardRow(target, world)).filter((row) => row.attempts > 0);
}
