// the one swap point between the UI and the backend; no method runs an attack, a target, a model, or a shell

import type {
  Account,
  AnalyticsSummary,
  BillingInterval,
  Campaign,
  CampaignStats,
  CampaignTimelineEvent,
  CampaignTranscript,
  CheckoutStart,
  CheckoutSuccess,
  Device,
  Finding,
  FindingStatus,
  Invoice,
  NotificationItem,
  OverviewStats,
  PaymentConfirmation,
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
  authorized: true; // the user confirms they are allowed to test this system
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

// a metadata export the dashboard can build from synced records
export interface ExportedFile {
  filename: string;
  mime: string;
  content: string;
}

// POST /device/approve answers `{ approved: true }` or `{ denied: true }`
export interface DeviceApproval {
  approved?: boolean;
  denied?: boolean;
}

// every method is scoped to the signed-in user's organization on the server, never by a client-side role
export interface ApiClient {
  getOverview(projectId?: string): Promise<OverviewStats>;

  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: NewProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "archived">>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // targets (registration metadata only; the dashboard never contacts a target)
  listTargets(filter?: ListFilter): Promise<Target[]>;
  getTarget(id: string): Promise<Target | null>;
  createTarget(input: NewTargetInput): Promise<Target>;

  listCampaigns(filter?: ListFilter): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | null>;
  getCampaignTimeline(id: string): Promise<CampaignTimelineEvent[]>;
  getCampaignStats(id: string): Promise<CampaignStats | null>;
  // runs synced without transcript sync come back with `synced: false`
  getCampaignTranscript(id: string): Promise<CampaignTranscript | null>;
  createCampaign(input: NewCampaignInput): Promise<Campaign>;
  renameCampaign(id: string, name: string): Promise<Campaign>;
  // draft -> ready: the local engine picks it up, the cloud never runs it
  markCampaignReady(id: string): Promise<Campaign>;
  // ready -> draft, before an engine has picked it up
  unmarkCampaignReady(id: string): Promise<Campaign>;
  deleteCampaign(id: string): Promise<void>;

  listFindings(filter?: ListFilter): Promise<Finding[]>;
  getFinding(id: string): Promise<Finding | null>;
  // lifecycle only, never mutates the original local evidence
  updateFindingStatus(id: string, status: FindingStatus): Promise<Finding>;

  listDevices(filter?: ListFilter): Promise<Device[]>;
  getDevice(id: string): Promise<Device | null>;
  renameDevice(id: string, name: string): Promise<Device>;
  // revoking the scoped sync token drops the device back to local-only mode
  revokeDevice(id: string): Promise<void>;
  // RFC 8628 device flow by user code (XXXX-XXXX); the engine gets a scoped token, never the Google token
  approveDevice(userCode: string, projectId: string | null, approve: boolean): Promise<DeviceApproval>;

  getAnalytics(projectId?: string): Promise<AnalyticsSummary>;

  listReports(filter?: ListFilter): Promise<Report[]>;
  // refuses reports that are local-only
  exportReport(id: string, format: ReportFormat): Promise<ExportedFile>;

  // billing (docs/billing/razorpay.md)
  getSubscription(): Promise<Subscription>;
  listPlans(): Promise<Plan[]>;
  listInvoices(): Promise<Invoice[]>;
  startCheckout(planId: "pro", interval: BillingInterval): Promise<CheckoutStart>;
  // the server checks the signature and asks Razorpay itself; the browser's word is never proof of payment
  confirmPayment(result: CheckoutSuccess): Promise<PaymentConfirmation>;

  getSettings(): Promise<WorkspaceSettings>;
  updateSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings>;

  getAccount(): Promise<Account>;
  updateAccount(patch: Pick<Account, "name">): Promise<Account>;
  listNotifications(): Promise<NotificationItem[]>;
  search(query: string): Promise<SearchResult[]>;
}
