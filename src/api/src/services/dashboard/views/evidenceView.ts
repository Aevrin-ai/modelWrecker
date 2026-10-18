import type { Row } from "../../../types/deps";
import { str } from "../../../lib/strings";
import type { FindingView } from "./findingView";

/** The stored evidence detail, as the sync route wrote it. */
type EvidenceDetail = {
  objective?: { title?: string; category?: string; success_criteria?: string };
  strategy?: string;
  transforms?: string[];
  payload?: string;
  response?: string;
  reasoning?: string;
  tool_calls?: { name: string; args: string }[];
  judge?: {
    outcome?: string;
    score?: number;
    rationale?: string;
    signals?: { signal: string; hit: boolean; score: number; detail: string }[];
  };
  conversation?: { role: string; text: string }[];
};

function evidenceView(detail: EvidenceDetail, finding: FindingView, row: Row, runExternalId: string) {
  return {
    synced: true,
    strategy: detail.strategy ?? finding.strategy,
    payload: detail.payload ?? "",
    transformChain: detail.transforms ?? [],
    targetResponse: detail.response ?? "",
    targetReasoning: detail.reasoning ?? "",
    toolCalls: detail.tool_calls ?? [],
    attackSequence: (detail.conversation ?? []).map((turn, i) => ({ step: i + 1, role: turn.role, text: turn.text })),
    objective: {
      title: detail.objective?.title ?? "",
      category: detail.objective?.category ?? "",
      successCriteria: detail.objective?.success_criteria ?? "",
    },
    judge: { outcome: detail.judge?.outcome ?? "", score: detail.judge?.score ?? 0, rationale: detail.judge?.rationale ?? "" },
    reproductionSteps: runExternalId ? `modelwrecker report runs/${runExternalId}` : undefined,
    syncedAt: str(row.updated_at),
  };
}

/** A finding with its synced evidence (dashboard `Evidence` type), or the metadata-only shape. */
export function withEvidence(finding: FindingView, row: Row | null, runExternalId: string) {
  if (!row) return { ...finding, evidence: { synced: false } };
  const detail = (row.detail ?? {}) as EvidenceDetail;
  const signals = (detail.judge?.signals ?? []).map((entry) => ({
    signal: entry.signal,
    hit: entry.hit,
    score: entry.score,
    detail: entry.detail,
  }));
  return { ...finding, signals, evidence: evidenceView(detail, finding, row, runExternalId) };
}
