/*
  The ApiClient interface is the ONE swap point between the UI and the backend.

  The whole dashboard talks to this interface only. Two implementations exist:
  MockApiClient (reads src/data/mock, the default) and HttpApiClient (the real
  control-plane API, chosen with VITE_API_MODE=http). src/api/index.ts picks one.
  No page or component imports mock data directly, so nothing in the UI changes.

  Boundary: this is a management API. There is deliberately no method to execute an
  attack, run a target, call a model, run a shell command, or make an arbitrary network
  request. The strongest campaign action is `markCampaignReady`, which only flags a
  campaign so the user's local engine can pick it up.

  Security note (enforced server-side, not here): every method is scoped to the
  authenticated user's organization. The client never trusts a client-side role,
  plan, or project id. See docs/architecture/cloud-control-plane.md.
*/

import type {
  Account,
  AnalyticsSummary,
  Campaign,
  CampaignStats,
  CampaignTimelineEvent,
  Device,
  Finding,
  FindingStatus,
  Invoice,
  NotificationItem,
  OverviewStats,
  Plan,
  Project,
  Report,
  ReportFormat,
  SearchResult,
  Subscription,
  Target,
  TargetType,
  WorkspaceSettings,
} from "@/types";

export interface ListFilter {
  projectId?: string;
  campaignId?: string;
  targetId?: string;
  query?: string;
}

export interface NewProjectInput {
  name: string;
  description: string;
}

export interface NewTargetInput {
  name: string;
  type: TargetType;
  provider: string;
  endpoint: string;
  model: string;
  projectId: string;
  /** The user confirms they are allowed to test this system. Required. */
  authorized: true;
}

export interface NewCampaignInput {
  name: string;
  projectId: string;
  targetId: string;
  strategies: string[];
  objectiveCount: number;
  stopCondition: Campaign["stopCondition"];
  concurrency: number;
  maxAttempts: number | null;
}

/** A metadata export the dashboard can build from synced records. */
export interface ExportedFile {
  filename: string;
  mime: string;
  content: string;
}

/** Result of POST /device/approve: `{ approved: true }` or `{ denied: true }`. */
export interface DeviceApproval {
  approved?: boolean;
  denied?: boolean;
}

export interface ApiClient {
  // overview
  getOverview(projectId?: string): Promise<OverviewStats>;

  // projects
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: NewProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "archived">>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // targets (registration metadata only; the dashboard never contacts a target)
  listTargets(filter?: ListFilter): Promise<Target[]>;
  getTarget(id: string): Promise<Target | null>;
  createTarget(input: NewTargetInput): Promise<Target>;

  // campaigns
  listCampaigns(filter?: ListFilter): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | null>;
  getCampaignTimeline(id: string): Promise<CampaignTimelineEvent[]>;
  getCampaignStats(id: string): Promise<CampaignStats | null>;
  createCampaign(input: NewCampaignInput): Promise<Campaign>;
  renameCampaign(id: string, name: string): Promise<Campaign>;
  /** draft -> ready. The local engine picks it up; the cloud never runs it. */
  markCampaignReady(id: string): Promise<Campaign>;
  /** ready -> draft, before an engine has picked it up. */
  unmarkCampaignReady(id: string): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;

  // findings
  listFindings(filter?: ListFilter): Promise<Finding[]>;
  getFinding(id: string): Promise<Finding | null>;
  /** Lifecycle only. Never mutates the original local evidence. */
  updateFindingStatus(id: string, status: FindingStatus): Promise<Finding>;

  // devices
  listDevices(filter?: ListFilter): Promise<Device[]>;
  getDevice(id: string): Promise<Device | null>;
  renameDevice(id: string, name: string): Promise<Device>;
  /** Revokes the device's scoped sync token. The device falls back to local-only mode. */
  revokeDevice(id: string): Promise<void>;
  /**
   * Approve or deny a `modelwrecker login` request by its user code (XXXX-XXXX), the RFC 8628
   * device flow. On approve the engine receives its scoped device token on its next poll; the
   * device record is created then. The user's Google token is never involved.
   */
  approveDevice(userCode: string, projectId: string | null, approve: boolean): Promise<DeviceApproval>;

  // analytics
  getAnalytics(projectId?: string): Promise<AnalyticsSummary>;

  // reports
  listReports(filter?: ListFilter): Promise<Report[]>;
  /** Export a synced report's metadata. Refuses reports that are local-only. */
  exportReport(id: string, format: ReportFormat): Promise<ExportedFile>;

  // billing
  getSubscription(): Promise<Subscription>;
  listPlans(): Promise<Plan[]>;
  listInvoices(): Promise<Invoice[]>;

  // settings
  getSettings(): Promise<WorkspaceSettings>;
  updateSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings>;

  // account + chrome
  getAccount(): Promise<Account>;
  updateAccount(patch: Pick<Account, "name">): Promise<Account>;
  listNotifications(): Promise<NotificationItem[]>;
  search(query: string): Promise<SearchResult[]>;
}
