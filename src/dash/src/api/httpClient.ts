// the real ApiClient (VITE_API_MODE=http) for docs/architecture/control-plane-api.md; it cannot run attacks

import type {
  ApiClient,
  DeviceApproval,
  ExportedFile,
  ListFilter,
  NewCampaignInput,
  NewProjectInput,
  NewTargetInput,
} from "./client";
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
  SearchResult,
  Subscription,
  Target,
  WorkspaceSettings,
} from "@/types";
import { ApiError } from "./apiError";
import { createHttpTransport, type HttpTransport } from "./httpTransport";
import { buildFilterQuery, buildQuery } from "./queryString";

export { ApiError };

const encodeId = encodeURIComponent;

export class HttpApiClient implements ApiClient {
  private readonly http: HttpTransport;

  constructor(baseUrl: string) {
    this.http = createHttpTransport(baseUrl);
  }

  getOverview(projectId?: string) {
    return this.http.get<OverviewStats>(`/overview${buildQuery({ projectId })}`);
  }

  listProjects() {
    return this.http.get<Project[]>("/projects");
  }
  getProject(id: string) {
    return this.http.getOrNull<Project>(`/projects/${encodeId(id)}`);
  }
  createProject(input: NewProjectInput) {
    return this.http.request<Project>("POST", "/projects", input);
  }
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "archived">>) {
    return this.http.request<Project>("PATCH", `/projects/${encodeId(id)}`, patch);
  }
  async deleteProject(id: string) {
    await this.http.request<unknown>("DELETE", `/projects/${encodeId(id)}`);
  }

  listTargets(filter?: ListFilter) {
    return this.http.get<Target[]>(`/targets${buildFilterQuery(filter)}`);
  }
  getTarget(id: string) {
    return this.http.getOrNull<Target>(`/targets/${encodeId(id)}`);
  }
  createTarget(input: NewTargetInput) {
    return this.http.request<Target>("POST", "/targets", input);
  }

  listCampaigns(filter?: ListFilter) {
    return this.http.get<Campaign[]>(`/campaigns${buildFilterQuery(filter)}`);
  }
  getCampaign(id: string) {
    return this.http.getOrNull<Campaign>(`/campaigns/${encodeId(id)}`);
  }
  getCampaignTimeline(id: string) {
    return this.http.get<CampaignTimelineEvent[]>(`/campaigns/${encodeId(id)}/timeline`);
  }
  getCampaignStats(id: string) {
    return this.http.getOrNull<CampaignStats>(`/campaigns/${encodeId(id)}/stats`);
  }
  getCampaignTranscript(id: string) {
    return this.http.getOrNull<CampaignTranscript>(`/campaigns/${encodeId(id)}/transcript`);
  }
  createCampaign(input: NewCampaignInput) {
    return this.http.request<Campaign>("POST", "/campaigns", input);
  }
  renameCampaign(id: string, name: string) {
    return this.http.request<Campaign>("PATCH", `/campaigns/${encodeId(id)}`, { name });
  }
  markCampaignReady(id: string) {
    return this.http.request<Campaign>("POST", `/campaigns/${encodeId(id)}/ready`);
  }
  unmarkCampaignReady(id: string) {
    return this.http.request<Campaign>("POST", `/campaigns/${encodeId(id)}/draft`);
  }
  async deleteCampaign(id: string) {
    await this.http.request<unknown>("DELETE", `/campaigns/${encodeId(id)}`);
  }

  listFindings(filter?: ListFilter) {
    return this.http.get<Finding[]>(`/findings${buildFilterQuery(filter)}`);
  }
  getFinding(id: string) {
    return this.http.getOrNull<Finding>(`/findings/${encodeId(id)}`);
  }
  updateFindingStatus(id: string, status: FindingStatus) {
    return this.http.request<Finding>("PATCH", `/findings/${encodeId(id)}`, { status });
  }

  listDevices(filter?: ListFilter) {
    return this.http.get<Device[]>(`/devices${buildFilterQuery(filter)}`);
  }
  getDevice(id: string) {
    return this.http.getOrNull<Device>(`/devices/${encodeId(id)}`);
  }
  renameDevice(id: string, name: string) {
    return this.http.request<Device>("PATCH", `/devices/${encodeId(id)}`, { name });
  }
  async revokeDevice(id: string) {
    await this.http.request<unknown>("POST", `/devices/${encodeId(id)}/revoke`);
  }
  async approveDevice(userCode: string, projectId: string | null, approve: boolean): Promise<DeviceApproval> {
    const res = await this.http.request<{ approved?: unknown; denied?: unknown }>("POST", "/device/approve", {
      user_code: userCode,
      project_id: projectId,
      approve,
    });
    return { approved: res?.approved === true || undefined, denied: res?.denied === true || undefined };
  }

  getAnalytics(projectId?: string) {
    return this.http.get<AnalyticsSummary>(`/analytics${buildQuery({ projectId })}`);
  }

  listReports(filter?: ListFilter) {
    return this.http.get<Report[]>(`/reports${buildFilterQuery(filter)}`);
  }
  async exportReport(): Promise<ExportedFile> {
    // the API has no report files yet; they stay with the engine that wrote them
    throw new ApiError(
      0,
      "reports_on_device",
      "Reports are on the device. Open them from the runs folder of your local engine.",
    );
  }

  getSubscription() {
    return this.http.get<Subscription>("/subscription");
  }
  listPlans() {
    return this.http.get<Plan[]>("/plans");
  }
  listInvoices() {
    return this.http.get<Invoice[]>("/invoices");
  }
  startCheckout(planId: "pro", interval: BillingInterval) {
    return this.http.request<CheckoutStart>("POST", "/billing/checkout", { plan: planId, interval });
  }
  confirmPayment(result: CheckoutSuccess) {
    return this.http.request<PaymentConfirmation>("POST", "/billing/verify", {
      razorpay_order_id: result.razorpay_order_id,
      razorpay_payment_id: result.razorpay_payment_id,
      razorpay_signature: result.razorpay_signature,
    });
  }

  getSettings() {
    return this.http.get<WorkspaceSettings>("/settings");
  }
  updateSettings(patch: Partial<WorkspaceSettings>) {
    return this.http.request<WorkspaceSettings>("PATCH", "/settings", patch);
  }
  getAccount() {
    return this.http.get<Account>("/me");
  }
  updateAccount(patch: Pick<Account, "name">) {
    return this.http.request<Account>("PATCH", "/me", { name: patch.name });
  }
  listNotifications() {
    return this.http.get<NotificationItem[]>("/notifications");
  }
  search(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return Promise.resolve<SearchResult[]>([]);
    return this.http.get<SearchResult[]>(`/search${buildQuery({ q: trimmedQuery })}`);
  }
}
