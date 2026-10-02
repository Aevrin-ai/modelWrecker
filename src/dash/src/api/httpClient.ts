/*
  HttpApiClient - the real backing for ApiClient (VITE_API_MODE=http).

  A thin mapping onto the control-plane API contract in docs/architecture/control-plane-api.md:
    - base URL `${VITE_API_BASE ?? "/api/v1"}`, same origin in production
    - `Authorization: Bearer <Supabase access token>` on every call, read fresh from the Supabase
      session (which refreshes it when needed). Never a cookie, so no cross-site request forgery.
    - JSON request and response bodies; responses already use the types in src/types.
    - errors are `{ "error": "<code>", "message": "<safe text>" }`. Only `message` is ever shown;
      a raw body, status text, or stack trace never reaches the UI.
    - 401 signs the user out of this browser, which returns them to the sign-in screen.

  Like the interface, this client has no way to run an attack, call a model, or fetch an arbitrary URL.
*/

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
  SearchResult,
  Subscription,
  Target,
  WorkspaceSettings,
} from "@/types";
import { getSupabase } from "@/lib/supabase";

const TIMEOUT_MS = 20_000;
const MAX_MESSAGE = 300;

/** An API failure with a message that is safe to show. `code` is the contract's error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const FALLBACK_MESSAGE: Record<number, string> = {
  400: "The request was not accepted.",
  403: "You do not have access to this.",
  404: "That record was not found.",
  409: "That conflicts with the current state. Refresh and try again.",
  410: "That has expired.",
  413: "The request was too large.",
  429: "Too many requests. Wait a moment and try again.",
};

function safeMessage(status: number, body: unknown): { code: string; message: string } {
  let code = `http_${status}`;
  let message = FALLBACK_MESSAGE[status] ?? (status >= 500 ? "The control plane had a problem. Try again shortly." : "The request failed.");
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.error === "string" && /^[a-z0-9_]{1,64}$/i.test(b.error)) code = b.error;
    if (typeof b.message === "string" && b.message.trim()) message = b.message.trim().slice(0, MAX_MESSAGE);
  }
  return { code, message };
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function filterQs(filter?: ListFilter): string {
  return qs({
    projectId: filter?.projectId,
    campaignId: filter?.campaignId,
    targetId: filter?.targetId,
    q: filter?.query,
  });
}

const enc = encodeURIComponent;

export class HttpApiClient implements ApiClient {
  constructor(private readonly baseUrl: string) {}

  private async token(): Promise<string> {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      await sb.auth.signOut({ scope: "local" });
      throw new ApiError(401, "unauthorized", "Your session has ended. Please sign in again.");
    }
    return token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.token();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, "network_error", "The control plane did not respond.");
    } finally {
      clearTimeout(timer);
    }

    let parsed: unknown = undefined;
    const text = res.status === 204 ? "" : await res.text().catch(() => "");
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined; // never surface a non-JSON body
      }
    }

    if (res.status === 401) {
      try {
        const sb = await getSupabase();
        await sb.auth.signOut({ scope: "local" });
      } catch {
        /* nothing to clear */
      }
      throw new ApiError(401, "unauthorized", "Your session has ended. Please sign in again.");
    }
    if (!res.ok) {
      const { code, message } = safeMessage(res.status, parsed);
      throw new ApiError(res.status, code, message);
    }
    if (text && parsed === undefined) {
      throw new ApiError(res.status, "bad_response", "The control plane sent an unexpected response.");
    }
    return parsed as T;
  }

  private get<T>(path: string) {
    return this.request<T>("GET", path);
  }

  /** GET a single record; a 404 means "not found" (null), as in the mock. */
  private async getOrNull<T>(path: string): Promise<T | null> {
    try {
      return await this.get<T>(path);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  // --- overview ---
  getOverview(projectId?: string) {
    return this.get<OverviewStats>(`/overview${qs({ projectId })}`);
  }

  // --- projects ---
  listProjects() {
    return this.get<Project[]>("/projects");
  }
  getProject(id: string) {
    return this.getOrNull<Project>(`/projects/${enc(id)}`);
  }
  createProject(input: NewProjectInput) {
    return this.request<Project>("POST", "/projects", input);
  }
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "archived">>) {
    return this.request<Project>("PATCH", `/projects/${enc(id)}`, patch);
  }
  async deleteProject(id: string) {
    await this.request<unknown>("DELETE", `/projects/${enc(id)}`);
  }

  // --- targets ---
  listTargets(filter?: ListFilter) {
    return this.get<Target[]>(`/targets${filterQs(filter)}`);
  }
  getTarget(id: string) {
    return this.getOrNull<Target>(`/targets/${enc(id)}`);
  }
  createTarget(input: NewTargetInput) {
    return this.request<Target>("POST", "/targets", input);
  }

  // --- campaigns ---
  listCampaigns(filter?: ListFilter) {
    return this.get<Campaign[]>(`/campaigns${filterQs(filter)}`);
  }
  getCampaign(id: string) {
    return this.getOrNull<Campaign>(`/campaigns/${enc(id)}`);
  }
  getCampaignTimeline(id: string) {
    return this.get<CampaignTimelineEvent[]>(`/campaigns/${enc(id)}/timeline`);
  }
  getCampaignStats(id: string) {
    return this.getOrNull<CampaignStats>(`/campaigns/${enc(id)}/stats`);
  }
  createCampaign(input: NewCampaignInput) {
    return this.request<Campaign>("POST", "/campaigns", input);
  }
  renameCampaign(id: string, name: string) {
    return this.request<Campaign>("PATCH", `/campaigns/${enc(id)}`, { name });
  }
  markCampaignReady(id: string) {
    return this.request<Campaign>("POST", `/campaigns/${enc(id)}/ready`);
  }
  unmarkCampaignReady(id: string) {
    return this.request<Campaign>("POST", `/campaigns/${enc(id)}/draft`);
  }
  async deleteCampaign(id: string) {
    await this.request<unknown>("DELETE", `/campaigns/${enc(id)}`);
  }

  // --- findings ---
  listFindings(filter?: ListFilter) {
    return this.get<Finding[]>(`/findings${filterQs(filter)}`);
  }
  getFinding(id: string) {
    return this.getOrNull<Finding>(`/findings/${enc(id)}`);
  }
  updateFindingStatus(id: string, status: FindingStatus) {
    return this.request<Finding>("PATCH", `/findings/${enc(id)}`, { status });
  }

  // --- devices ---
  listDevices(filter?: ListFilter) {
    return this.get<Device[]>(`/devices${filterQs(filter)}`);
  }
  getDevice(id: string) {
    return this.getOrNull<Device>(`/devices/${enc(id)}`);
  }
  renameDevice(id: string, name: string) {
    return this.request<Device>("PATCH", `/devices/${enc(id)}`, { name });
  }
  async revokeDevice(id: string) {
    await this.request<unknown>("POST", `/devices/${enc(id)}/revoke`);
  }
  async approveDevice(userCode: string, projectId: string | null, approve: boolean): Promise<DeviceApproval> {
    const res = await this.request<{ approved?: unknown; denied?: unknown }>("POST", "/device/approve", {
      user_code: userCode,
      project_id: projectId,
      approve,
    });
    return { approved: res?.approved === true || undefined, denied: res?.denied === true || undefined };
  }

  // --- analytics ---
  getAnalytics(projectId?: string) {
    return this.get<AnalyticsSummary>(`/analytics${qs({ projectId })}`);
  }

  // --- reports ---
  listReports(filter?: ListFilter) {
    return this.get<Report[]>(`/reports${filterQs(filter)}`);
  }
  async exportReport(): Promise<ExportedFile> {
    // The API has no report files yet; they stay with the engine that wrote them.
    throw new ApiError(
      0,
      "reports_on_device",
      "Reports are on the device. Open them from the runs folder of your local engine.",
    );
  }

  // --- billing ---
  getSubscription() {
    return this.get<Subscription>("/subscription");
  }
  listPlans() {
    return this.get<Plan[]>("/plans");
  }
  listInvoices() {
    return this.get<Invoice[]>("/invoices");
  }

  // --- settings / account ---
  getSettings() {
    return this.get<WorkspaceSettings>("/settings");
  }
  updateSettings(patch: Partial<WorkspaceSettings>) {
    return this.request<WorkspaceSettings>("PATCH", "/settings", patch);
  }
  getAccount() {
    return this.get<Account>("/me");
  }
  updateAccount(patch: Pick<Account, "name">) {
    return this.request<Account>("PATCH", "/me", { name: patch.name });
  }
  listNotifications() {
    return this.get<NotificationItem[]>("/notifications");
  }
  search(query: string) {
    const q = query.trim();
    if (!q) return Promise.resolve<SearchResult[]>([]);
    return this.get<SearchResult[]>(`/search${qs({ q })}`);
  }
}
