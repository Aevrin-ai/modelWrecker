/*
  Dashboard domain types.

  These mirror the ModelWrecker engine data model (src/modelwrecker/data.py and
  docs/architecture/DATA-MODEL.md) for the parts the cloud control plane stores as
  metadata, plus the control-plane-only entities (Project, Device, Subscription).

  Important boundary note: the cloud stores METADATA only. Detailed evidence
  (payloads, transcripts, reasoning) stays on the user's local engine unless the
  user explicitly enables evidence sync. Fields that may be local-only are marked
  optional and the UI must show a "stays local" state when they are absent.
*/

// --- engine enums (verbatim from data.py) ---------------------------------------------

/** Verdict.outcome */
export type Outcome = "refused" | "partial" | "success" | "error";

/** ReliabilityResult.confidence */
export type ConfidenceLevel = "reliable" | "flaky" | "does_not_hold";

/** Finding.severity */
export type Severity = "info" | "low" | "medium" | "high" | "critical";

/** Finding.status */
export type FindingStatus = "open" | "triaged" | "fixed" | "accepted-risk";

/** Target type selected by config.target.type */
export type TargetType = "chat" | "agent" | "rag" | "mcp";

/** Engine capabilities a target declares (docs/targets/OVERVIEW.md). */
export type Capability =
  | "send_message"
  | "send_multiturn"
  | "upload_image"
  | "call_tool"
  | "observe_tool_call"
  | "reset_session"
  | "get_metadata"
  | "ingest_document";

/**
 * Campaign / run status.
 * The engine's RunResult is lightweight (run_id + findings). These richer states
 * are a control-plane concept: the dashboard configures a campaign (draft), marks it
 * ready for the local engine (ready), the engine picks it up (queued -> running),
 * and results sync back (syncing -> completed). The dashboard itself never moves a
 * campaign past "ready" - only the local engine does.
 */
export type CampaignStatus =
  | "draft"
  | "ready"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stopped"
  | "syncing";

export type DeviceStatus = "online" | "offline" | "syncing";

export type TargetStatus = "active" | "ready" | "idle" | "error";

// --- taxonomy -------------------------------------------------------------------------

export interface TaxonomyRef {
  framework: "owasp_llm" | "owasp_asi" | "owasp_mcp" | "mitre_atlas" | string;
  id: string; // e.g. LLM01, ASI01, MCP03, AML.T0051
  edition?: string | null; // "2025" | "2026"
  title?: string | null;
}

// --- control-plane entities -----------------------------------------------------------

export interface Project {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  createdAt: string;
  lastActivityAt: string | null;
  // rollup counts synced from the local engine
  counts: {
    targets: number;
    campaigns: number;
    findings: number;
    devices: number;
  };
  riskSummary: Record<Severity, number>;
}

export interface Device {
  id: string;
  name: string;
  status: DeviceStatus;
  engineVersion: string; // ModelWrecker engine version, e.g. "0.0.1"
  os: string; // "macOS 14.5", "Ubuntu 22.04", "Windows 11"
  lastSeenAt: string;
  /** Last time this device pushed metadata to the control plane. */
  lastSyncAt: string | null;
  projectId: string | null;
  projectName: string | null;
  engineHealthy: boolean;
  // fingerprint for revoking; never machine PII beyond what is needed
  fingerprint: string;
}

export interface Target {
  id: string;
  name: string;
  type: TargetType;
  provider: string; // e.g. "OpenAI", "OpenRouter", "Local (Ollama)", "Custom"
  endpoint: string; // redacted/display form
  model: string;
  status: TargetStatus;
  projectId: string;
  projectName: string;
  authorized: boolean; // run refuses a target unless authorized: true
  capabilities: Capability[];
  lastTestedAt: string | null;
  campaignCount: number;
  topSeverity: Severity | null;
  createdAt: string;
}

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
  // configuration
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
  // results (synced metadata)
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  attemptCount: number;
  successfulAttacks: number;
  findingCount: number;
  successRate: number; // 0..1 (ASR)
  createdAt: string;
}

/** A point on a campaign timeline (synced attempt/objective progress metadata). */
export interface CampaignTimelineEvent {
  id: string;
  at: string;
  label: string;
  detail: string;
  kind: "info" | "attempt" | "finding" | "status";
}

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

/**
 * Detailed evidence. May be absent when it has not been synced (stays local).
 * `synced: false` means the cloud holds metadata only.
 */
export interface Evidence {
  synced: boolean;
  strategy?: string;
  strategyParams?: Record<string, unknown>;
  payload?: string;
  transformChain?: string[];
  targetResponse?: string;
  targetReasoning?: string;
  /** `args` is the JSON text the engine sent (synced evidence) or an object (mock data). */
  toolCalls?: { name: string; args: string | Record<string, unknown> }[];
  reproductionSteps?: string; // e.g. "modelwrecker report runs/<run-id>"
  attackSequence?: { step: number; role: string; text: string }[];
  objective?: { title: string; category: string; successCriteria: string };
  judge?: { outcome: string; score: number; rationale: string };
  syncedAt?: string;
}

/** One attack attempt as synced in a run transcript (only when transcript sync is on). */
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
  /** The local run folder name (runs/<runName>). */
  runName: string;
  startedAt: string | null;
  attemptCount: number;
  /** false when the run was synced without its transcript (the setting was off). */
  synced: boolean;
  /** true when the engine cut the list to stay under the size limit. */
  truncated: boolean;
  attempts: TranscriptAttempt[];
}

export interface CampaignTranscript {
  campaignId: string;
  runs: RunTranscript[];
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

/** Formats the engine's `analyze` command writes (static files). */
export type ReportFormat = "html" | "json" | "csv";

export interface Report {
  id: string;
  name: string;
  /** The local run directory the report was generated from (runs/<run-id>). */
  runId: string;
  projectId: string;
  projectName: string;
  campaignId: string | null;
  campaignName: string | null;
  kind: "campaign" | "analytics" | "leaderboard";
  formats: ReportFormat[];
  /**
   * "cloud": the summary metadata synced, so the dashboard can export it.
   * "local": only the report record synced; the file lives on the device.
   */
  availability: "cloud" | "local";
  findingCount: number;
  generatedAt: string;
  sizeBytes: number;
}

// --- analytics ------------------------------------------------------------------------

export interface TimeseriesPoint {
  date: string; // ISO date
  value: number;
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
  leaderboard: {
    targetId: string;
    targetName: string;
    asr: number;
    ciLow: number;
    ciHigh: number;
    attempts: number;
    /** Attacks that worked (the numerator of `asr`). */
    successes: number;
    /** Attempts the target refused. */
    refusals: number;
    findings: number;
    highCritical: number;
    /** The most recent campaign against this target, where its attempts can be read. */
    latestCampaignId: string | null;
  }[];
}

// --- overview (dashboard home) --------------------------------------------------------

export interface OverviewStats {
  totalCampaigns: number;
  activeTargets: number;
  totalFindings: number;
  criticalFindings: number;
  successfulAttacks: number;
  attackSuccessRate: number; // 0..1
  connectedDevices: number;
  runsThisPeriod: number;
  // deltas vs previous period (for the "+x% from last period" line)
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

/** Per-strategy attack statistics for one campaign (synced counts only). */
export interface CampaignStats {
  campaignId: string;
  byStrategy: { strategy: string; attempts: number; successes: number; partials: number }[];
}

// --- billing / entitlements -----------------------------------------------------------

/** Usage meters an entitlement can limit (docs/security/entitlements.md). */
export type MeterKey = "campaigns" | "attacks" | "devices" | "projects";

/** Boolean features an entitlement can switch on (docs/security/entitlements.md). */
export type FeatureKey =
  | "advanced_strategies"
  | "mcp"
  | "analytics"
  | "evidence_storage"
  | "enterprise";

/**
 * A plan tier. Plans are CONFIGURATION (src/lib/plans.ts), never hard-coded in a
 * component. Real prices and limits are set by the billing config on the server.
 */
export interface Plan {
  id: "free" | "pro" | "enterprise";
  name: string;
  blurb: string;
  /** Display-only price text from config. No price is invented in the UI. */
  priceLabel: string;
  highlighted?: boolean;
  /** null = unlimited. Placeholder values - configurable. */
  limits: Record<MeterKey, number | null>;
  features: Record<FeatureKey, boolean>;
}

export interface Subscription {
  planId: Plan["id"];
  planName: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  /** Payment status as reported by the verified billing webhook (server side). */
  paymentStatus: "not_required" | "paid" | "pending" | "failed";
  periodStart: string;
  periodEnd: string;
  currency: string;
  /** Usage this period, by meter. Limits come from the plan config. */
  usage: Record<MeterKey, number>;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void";
  issuedAt: string;
}

// --- account / settings ---------------------------------------------------------------

export interface Account {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  organization: string;
  avatarInitials: string;
  createdAt: string;
  /** Sign-in is Google OAuth (docs/security/authentication.md). */
  signInProvider: "google";
}

/**
 * Workspace settings held by the control plane. The sync settings are read by the
 * local engine; detailed evidence and transcripts stay local unless switched on.
 */
export interface WorkspaceSettings {
  sync: {
    /** Summary metadata (counts, severities, timestamps). Required for the dashboard. */
    metadata: true;
    /** Full evidence bundles (payloads, responses). Default OFF - stays local. */
    detailedEvidence: boolean;
    /** Raw multi-turn transcripts. Default OFF - stays local. */
    transcripts: boolean;
  };
  notifications: Record<NotificationItem["kind"], boolean>;
}

export interface NotificationItem {
  id: string;
  kind:
    | "campaign_completed"
    | "critical_finding"
    | "device_connected"
    | "device_disconnected"
    | "sync_failed"
    | "new_version"
    | "subscription_changed";
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
}

export interface SearchResult {
  id: string;
  kind: "project" | "target" | "campaign" | "finding" | "device" | "report";
  title: string;
  subtitle: string;
  href: string;
}
