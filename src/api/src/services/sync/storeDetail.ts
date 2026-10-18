import type { SyncEvidenceBody, SyncFindingBody, SyncRunBody } from "../../validators/schemas";
import type { SyncScope } from "./ingestRun";

interface FindingLinks {
  campaignId: unknown;
  targetId: unknown;
  runId: unknown;
}

/** The stored shape of one finding's evidence. Text was already redacted by the engine. */
function evidenceDetail(evidence: SyncEvidenceBody) {
  return {
    objective: evidence.objective,
    strategy: evidence.strategy,
    transforms: evidence.transforms,
    payload: evidence.payload,
    response: evidence.response,
    reasoning: evidence.reasoning,
    tool_calls: evidence.tool_calls,
    judge: evidence.judge,
    conversation: evidence.conversation,
  };
}

function findingRow(scope: SyncScope, finding: SyncFindingBody, links: FindingLinks, keepEvidence: boolean) {
  return {
    owner_id: scope.owner,
    external_id: finding.id,
    project_id: scope.projectId,
    campaign_id: links.campaignId,
    target_id: links.targetId,
    run_id: links.runId,
    title: finding.title,
    severity: finding.severity,
    score: finding.score,
    technique: finding.strategy,
    taxonomy: finding.taxonomy.map((entry) => `${entry.framework}:${entry.id}`).join(","),
    replays: finding.replays,
    successes: finding.successes,
    success_rate: finding.success_rate,
    confidence_low: finding.ci_low,
    confidence_high: finding.ci_high,
    confidence: finding.confidence,
    discovered_at: finding.discovered_at,
    last_seen_at: scope.now,
    // set only when evidence is stored, so a later metadata-only sync never hides evidence already in the cloud
    ...(keepEvidence ? { evidence_synced: true } : {}),
  };
}

/** Upsert each finding by the engine's id and return how many evidence records were kept. */
export async function storeFindings(
  scope: SyncScope,
  findings: SyncFindingBody[],
  links: FindingLinks,
  evidenceAllowed: boolean,
): Promise<number> {
  let evidenceStored = 0;
  for (const finding of findings) {
    const keepEvidence = evidenceAllowed && finding.evidence !== undefined;
    // `status` is never sent, so a lifecycle status the user set in the dashboard survives a re-sync
    const row = await scope.db.table("findings").upsert(findingRow(scope, finding, links, keepEvidence), ["owner_id", "external_id"]);
    if (keepEvidence && finding.evidence) {
      await scope.db.table("finding_evidence").upsert(
        { finding_id: row.id, owner_id: scope.owner, detail: evidenceDetail(finding.evidence), updated_at: scope.now },
        ["finding_id"],
      );
      evidenceStored += 1;
    }
  }
  return evidenceStored;
}

/** Keep the run's transcript when the account allows it. True when one was stored. */
export async function storeTranscript(
  scope: SyncScope,
  transcript: SyncRunBody["transcript"],
  runId: unknown,
  transcriptsAllowed: boolean,
): Promise<boolean> {
  if (!transcriptsAllowed || !transcript) return false;
  await scope.db.table("run_transcripts").upsert(
    {
      run_id: runId,
      owner_id: scope.owner,
      attempts: transcript.attempts,
      truncated: transcript.truncated,
      updated_at: scope.now,
    },
    ["run_id"],
  );
  return true;
}
