import type { AnalyticsSummary, OverviewStats } from "@/types";

export const EMPTY_OVERVIEW: OverviewStats = {
  totalCampaigns: 0,
  activeTargets: 0,
  totalFindings: 0,
  criticalFindings: 0,
  successfulAttacks: 0,
  attackSuccessRate: 0,
  connectedDevices: 0,
  runsThisPeriod: 0,
  deltas: {},
};

export const EMPTY_ANALYTICS: AnalyticsSummary = {
  asr: 0,
  asrCiLow: 0,
  asrCiHigh: 0,
  robustness: 1,
  totalAttempts: 0,
  totalFindings: 0,
  severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  byStrategy: [],
  byCategory: [],
  byTaxonomy: [],
  successRateOverTime: [],
  findingsOverTime: [],
  campaignActivity: [],
  leaderboard: [],
};
