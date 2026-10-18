// the parts of API response bodies the tests read; fields a test only compares stay `unknown`

export interface IdBody {
  id: string;
}

export interface EvidenceBody {
  synced: boolean;
  payload?: string;
}

export interface FindingBody {
  id: string;
  campaignId: string;
  status: string;
  reliability: unknown;
  evidence: EvidenceBody;
  signals: unknown[];
}

export interface TargetBody {
  id: string;
  endpoint: string;
}

export interface CampaignBody {
  id: string;
  status: string;
}

export interface AnalyticsBody {
  asr: number;
  totalAttempts: number;
  leaderboardLocked: boolean;
  leaderboard: { latestCampaignId: string | null }[];
}

export interface TranscriptBody {
  runs: { attempts: unknown[] }[];
}

export interface HeartbeatBody {
  sync: unknown;
  plan?: string;
  entitlement?: string;
}
