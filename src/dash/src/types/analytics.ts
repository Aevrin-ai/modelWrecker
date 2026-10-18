import type { Severity } from "./engine";

export interface TimeseriesPoint {
  date: string; // ISO date
  value: number;
}

export interface LeaderboardRow {
  targetId: string;
  targetName: string;
  asr: number;
  ciLow: number;
  ciHigh: number;
  attempts: number;
  successes: number; // attacks that worked, the numerator of `asr`
  refusals: number;
  findings: number;
  highCritical: number;
  latestCampaignId: string | null; // where this target's attempts can be read
}

export interface AnalyticsSummary {
  asr: number; // overall attack success rate
  asrCiLow: number;
  asrCiHigh: number;
  robustness: number; // 1 - asr
  totalAttempts: number;
  totalFindings: number;
  severityBreakdown: Record<Severity, number>;
  byStrategy: { strategy: string; attempts: number; asr: number }[];
  byCategory: { category: string; attempts: number; asr: number }[];
  byTaxonomy: { framework: string; id: string; title: string; count: number }[];
  successRateOverTime: TimeseriesPoint[];
  findingsOverTime: TimeseriesPoint[];
  campaignActivity: {
    date: string;
    campaigns: number;
    runs: number;
    successfulAttacks: number;
  }[];
  leaderboard: LeaderboardRow[];
  leaderboardLocked?: boolean; // true when the plan has no leaderboard (Pro); `leaderboard` is then empty
}

export interface OverviewStats {
  totalCampaigns: number;
  activeTargets: number;
  totalFindings: number;
  criticalFindings: number;
  successfulAttacks: number;
  attackSuccessRate: number; // 0..1
  connectedDevices: number;
  runsThisPeriod: number;
  // deltas vs the previous period, for the "+x% from last period" line
  deltas: Partial<
    Record<
      | "totalCampaigns"
      | "totalFindings"
      | "criticalFindings"
      | "attackSuccessRate"
      | "runsThisPeriod",
      number
    >
  >;
}
