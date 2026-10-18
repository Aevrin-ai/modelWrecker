import type { Database, Row } from "../../../types/deps";
import { str } from "../../../lib/strings";
import { campaignTotals } from "./campaignView";
import { iso, num } from "../rows";
import { type World } from "../world";
import { runTranscriptsRepository } from "../../../repositories/runTranscripts";

interface StrategyCount {
  strategy: string;
  attempts: number;
  successes: number;
  partials: number;
}

export function timelineEvents(campaign: Row, world: World) {
  const created = { id: `${campaign.id}-created`, at: str(campaign.created_at), label: "Campaign created", detail: str(campaign.name), kind: "status" };
  const runs = campaignTotals(campaign, world).runs.map((run) => ({
    id: `run-${run.id}`,
    at: str(run.completed_at ?? run.created_at),
    label: "Run synced",
    detail: `${num(run.successful_attacks)} of ${num(run.attempts)} attempts succeeded`,
    kind: "attempt",
  }));
  const findings = world.findings
    .filter((finding) => str(finding.campaign_id) === str(campaign.id))
    .map((finding) => ({
      id: `finding-${finding.id}`,
      at: str(finding.discovered_at ?? finding.created_at),
      label: "Finding verified",
      detail: str(finding.title),
      kind: "finding",
    }));
  return [created, ...runs, ...findings].sort((first, second) => (first.at < second.at ? 1 : -1));
}

export function strategyTotals(runs: Row[]): StrategyCount[] {
  const merged = new Map<string, StrategyCount>();
  for (const run of runs) {
    for (const entry of (run.by_strategy as StrategyCount[] | null) ?? []) {
      const total = merged.get(entry.strategy) ?? { strategy: entry.strategy, attempts: 0, successes: 0, partials: 0 };
      total.attempts += num(entry.attempts);
      total.successes += num(entry.successes);
      total.partials += num(entry.partials);
      merged.set(entry.strategy, total);
    }
  }
  return [...merged.values()];
}

function attemptView(attempt: Record<string, unknown>, i: number) {
  return {
    index: i + 1,
    at: iso(attempt.at),
    objective: str(attempt.objective),
    category: str(attempt.category),
    strategy: str(attempt.strategy),
    outcome: str(attempt.outcome),
    score: num(attempt.score),
    payload: str(attempt.payload),
    response: str(attempt.response),
  };
}

export async function runTranscript(db: Database, owner: string, run: Row) {
  const transcript = await runTranscriptsRepository(db).findForRun(str(run.id), owner);
  const attempts = (transcript?.attempts as Record<string, unknown>[] | undefined) ?? [];
  return {
    runId: str(run.id),
    runName: str(run.external_id),
    startedAt: iso(run.started_at),
    attemptCount: num(run.attempts),
    synced: Boolean(transcript),
    truncated: Boolean(transcript?.truncated),
    attempts: attempts.map(attemptView),
  };
}
