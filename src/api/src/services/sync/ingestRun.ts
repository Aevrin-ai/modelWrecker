import type { Database, Deps, Row } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { readSyncPolicy } from "./syncPolicy";
import type { SyncBody, SyncRunBody } from "../../validators/schemas";
import { storeFindings, storeTranscript } from "./storeDetail";

/** Where one synced run is stored: always the device's owner and project, never what the body says. */
export interface SyncScope {
  db: Database;
  owner: string;
  projectId: string;
  deviceId: unknown;
  now: string;
}

export interface IngestResult {
  campaign_id: string;
  run_id: string;
  findings: number;
  detail: { evidence: boolean; transcripts: boolean };
  stored: { evidence: number; transcript: boolean };
}

// created on first sight; a target the user registered in the dashboard is never overwritten
async function findOrCreateTarget(scope: SyncScope, target: SyncRunBody["target"]): Promise<Row> {
  const targets = scope.db.table("targets");
  const [existing] = await targets.select({ eq: { owner_id: scope.owner, project_id: scope.projectId, name: target.name } });
  if (existing) return existing;
  return targets.insert({
    owner_id: scope.owner,
    project_id: scope.projectId,
    name: target.name,
    type: target.type,
    provider: target.provider,
    model: target.model,
    endpoint: "",
    // the engine refuses to run against a target without authorized: true
    authorized: true,
  });
}

// keyed by the engine's campaign id within this project; a re-sync merges the strategies
async function upsertCampaign(scope: SyncScope, run: SyncRunBody, targetId: unknown): Promise<Row> {
  const campaigns = scope.db.table("campaigns");
  const strategies = run.by_strategy.map((entry) => entry.strategy);
  const completed = { status: "completed", target_id: targetId, device_id: scope.deviceId, completed_at: run.completed_at ?? scope.now };
  const [existing] = await campaigns.select({
    eq: { owner_id: scope.owner, project_id: scope.projectId, external_id: run.campaign.external_id },
  });
  if (existing) {
    const merged = Array.from(new Set([...((existing.strategies as string[]) ?? []), ...strategies]));
    const [updated] = await campaigns.update({ id: existing.id }, { ...completed, strategies: merged });
    return updated;
  }
  return campaigns.insert({
    owner_id: scope.owner,
    project_id: scope.projectId,
    external_id: run.campaign.external_id,
    name: run.campaign.name,
    ...completed,
    strategies,
    started_at: run.started_at,
  });
}

function upsertRun(scope: SyncScope, run: SyncRunBody, campaignId: unknown): Promise<Row> {
  const row = {
    owner_id: scope.owner,
    external_id: run.run_id,
    campaign_id: campaignId,
    device_id: scope.deviceId,
    model: run.target.model,
    provider: run.target.provider,
    attempts: run.attempts,
    successful_attacks: run.successes,
    partials: run.partials,
    refusals: run.refusals,
    errors: run.errors,
    success_rate: run.asr,
    asr_ci_low: run.asr_ci_low,
    asr_ci_high: run.asr_ci_high,
    by_strategy: run.by_strategy,
    started_at: run.started_at,
    completed_at: run.completed_at,
  };
  return scope.db.table("runs").upsert(row, ["owner_id", "external_id"]);
}

/** Store one synced run. Everything is pinned to the device's owner and project, never the body's. */
export async function ingestRun(deps: Deps, device: Row, body: SyncBody): Promise<IngestResult> {
  const db = deps.serviceDb;
  const owner = String(device.owner_id);
  const projectId = device.project_id ? String(device.project_id) : null;
  if (!projectId) throw new ApiError(409, "no_project", "This device is not linked to a project.");
  const run = body.run;
  const scope: SyncScope = { db, owner, projectId, deviceId: device.id, now: deps.now().toISOString() };
  // detail is kept only when the account allows it; the client's choice to send it is not enough
  const policy = await readSyncPolicy(db, owner, deps.now());

  const target = await findOrCreateTarget(scope, run.target);
  const campaign = await upsertCampaign(scope, run, target.id);
  const runRow = await upsertRun(scope, run, campaign.id);
  const links = { campaignId: campaign.id, targetId: target.id, runId: runRow.id };
  const evidenceStored = await storeFindings(scope, run.findings, links, policy.evidence);
  const transcriptStored = await storeTranscript(scope, run.transcript, runRow.id, policy.transcripts);

  await db.table("devices").update({ id: device.id }, { last_seen_at: scope.now });
  return {
    campaign_id: String(campaign.id),
    run_id: String(runRow.id),
    findings: run.findings.length,
    // what the account allows now and what was kept, so the engine re-sends a run once detail is turned on
    detail: { evidence: policy.evidence, transcripts: policy.transcripts },
    stored: { evidence: evidenceStored, transcript: transcriptStored },
  };
}
