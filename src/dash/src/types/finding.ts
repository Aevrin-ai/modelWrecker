import type { ConfidenceLevel, FindingStatus, Outcome, Severity, TargetType, TaxonomyRef } from "./engine";

export interface ReliabilityResult {
  attemptsRun: number;
  successes: number;
  partials: number;
  successRate: number;
  ciLow: number; // Wilson 95% lower bound
  ciHigh: number; // Wilson 95% upper bound
  highVariance: boolean;
  confidence: ConfidenceLevel;
  backendPinned: boolean;
}

export interface SignalResult {
  signal: string; // llm_judge, secret_detector, pii_detector, rule, tool_action...
  hit: boolean;
  score: number; // 0..1
  detail: string;
}

// detailed evidence stays local unless synced, so every field but `synced` may be missing
export interface Evidence {
  synced: boolean;
  strategy?: string;
  strategyParams?: Record<string, unknown>;
  payload?: string;
  transformChain?: string[];
  targetResponse?: string;
  targetReasoning?: string;
  // args is JSON text from synced evidence, or an object in mock data
  toolCalls?: { name: string; args: string | Record<string, unknown> }[];
  reproductionSteps?: string; // e.g. "modelwrecker report runs/<run-id>"
  attackSequence?: { step: number; role: string; text: string }[];
  objective?: { title: string; category: string; successCriteria: string };
  judge?: { outcome: string; score: number; rationale: string };
  syncedAt?: string;
}

export interface Finding {
  id: string;
  title: string;
  summary: string;
  severity: Severity;
  status: FindingStatus;
  outcome: Outcome;
  score: number; // 0..10 severity-of-bypass
  projectId: string;
  projectName: string;
  targetId: string;
  targetName: string;
  targetType: TargetType;
  campaignId: string;
  campaignName: string;
  strategy: string; // attack technique
  model: string;
  provider: string;
  taxonomy: TaxonomyRef[];
  reliability: ReliabilityResult;
  signals: SignalResult[];
  evidence: Evidence;
  relatedFindingIds: string[];
  discoveredAt: string;
  lastSeenAt: string;
}
