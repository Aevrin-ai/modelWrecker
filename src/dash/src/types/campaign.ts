import type { CampaignStatus, Outcome } from "./engine";

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  projectId: string;
  projectName: string;
  targetId: string;
  targetName: string;
  deviceId: string | null;
  deviceName: string | null;
  objectiveCount: number;
  strategies: string[]; // e.g. ["direct_jailbreak", "crescendo"]
  stopCondition: "complete" | "first_finding" | "budget";
  concurrency: number;
  budget: {
    maxAttempts: number | null;
    maxTokens: number | null;
    maxSeconds: number | null;
    maxObjectives: number | null;
  };
  // results below are synced metadata
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  attemptCount: number;
  successfulAttacks: number;
  findingCount: number;
  successRate: number; // 0..1 (ASR)
  createdAt: string;
}

export interface CampaignTimelineEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
  kind: "info" | "attempt" | "finding" | "status";
}

// one attack attempt, synced only when transcript sync is on
export interface TranscriptAttempt {
  index: number;
  at: string | null;
  objective: string;
  category: string;
  strategy: string;
  outcome: Outcome | string;
  score: number; // 0..10
  payload: string;
  response: string;
}

export interface RunTranscript {
  runId: string;
  runName: string; // the local run folder, runs/<runName>
  startedAt: string | null;
  attemptCount: number;
  synced: boolean; // false when the run synced without its transcript
  truncated: boolean; // true when the engine cut the list to stay under the size limit
  attempts: TranscriptAttempt[];
}

export interface CampaignTranscript {
  campaignId: string;
  runs: RunTranscript[];
}

export interface CampaignStats {
  campaignId: string;
  byStrategy: { strategy: string; attempts: number; successes: number; partials: number }[];
}
