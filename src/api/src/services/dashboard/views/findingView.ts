import type { Row } from "../../../types/deps";
import { str } from "../../../lib/strings";
import { byId, num } from "../rows";
import type { World } from "../world";

// "owasp_llm:LLM07,mitre:AML.T0051" -> [{ framework: "owasp_llm", id: "LLM07" }, ...]
export function parseTaxonomy(stored: unknown) {
  return str(stored)
    .split(",")
    .filter(Boolean)
    .map((entry) => {
      const [framework, ...rest] = entry.split(":");
      return { framework, id: rest.join(":") };
    });
}

function reliabilityOf(finding: Row) {
  return {
    attemptsRun: num(finding.replays),
    successes: num(finding.successes),
    partials: 0,
    successRate: num(finding.success_rate),
    ciLow: num(finding.confidence_low),
    ciHigh: num(finding.confidence_high),
    highVariance: false,
    confidence: str(finding.confidence) || "does_not_hold",
    backendPinned: false,
  };
}

/** A finding row as the dashboard's Finding type, metadata only. */
export function mapFinding(finding: Row, world: World) {
  const target = byId(world.targets).get(str(finding.target_id));
  const campaign = byId(world.campaigns).get(str(finding.campaign_id));
  const run = byId(world.runs).get(str(finding.run_id));
  return {
    id: str(finding.id),
    title: str(finding.title),
    summary: "",
    severity: str(finding.severity),
    status: str(finding.status) || "open",
    outcome: "success",
    score: num(finding.score),
    projectId: str(finding.project_id),
    projectName: str(byId(world.projects).get(str(finding.project_id))?.name),
    targetId: str(finding.target_id),
    targetName: str(target?.name),
    targetType: str(target?.type) || "chat",
    campaignId: str(finding.campaign_id),
    campaignName: str(campaign?.name),
    strategy: str(finding.technique),
    model: str(run?.model),
    provider: str(run?.provider),
    taxonomy: parseTaxonomy(finding.taxonomy),
    reliability: reliabilityOf(finding),
    signals: [],
    // metadata only in lists; the finding detail route adds the evidence when it was synced
    evidence: { synced: Boolean(finding.evidence_synced) },
    relatedFindingIds: [],
    discoveredAt: str(finding.discovered_at ?? finding.created_at),
    lastSeenAt: str(finding.last_seen_at ?? finding.created_at),
  };
}

export type FindingView = ReturnType<typeof mapFinding>;
