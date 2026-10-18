import type { Row } from "../../../types/deps";
import { str } from "../../../lib/strings";
import { emptySeverity, latest } from "../rows";
import { scope, type World } from "../world";

// open risk only: fixed findings and accepted risks no longer count
function riskSummary(findings: Row[]): Record<string, number> {
  const risk = emptySeverity();
  for (const finding of findings) {
    if (finding.status !== "fixed" && finding.status !== "accepted-risk") risk[str(finding.severity)] += 1;
  }
  return risk;
}

/** A project row as the dashboard's Project type. */
export function mapProject(project: Row, world: World) {
  const id = str(project.id);
  const own = scope(world, id);
  const runTimes = own.runs.map((run) => str(run.completed_at ?? run.created_at));
  const campaignTimes = own.campaigns.map((campaign) => str(campaign.created_at));
  const activity = latest([...runTimes, ...campaignTimes].filter(Boolean));
  return {
    id,
    name: str(project.name),
    description: str(project.description),
    archived: Boolean(project.archived),
    createdAt: str(project.created_at),
    lastActivityAt: activity ?? null,
    counts: {
      targets: own.targets.length,
      campaigns: own.campaigns.length,
      findings: own.findings.length,
      devices: own.devices.length,
    },
    riskSummary: riskSummary(own.findings),
  };
}
