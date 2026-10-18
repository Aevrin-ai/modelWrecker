// development ApiClient: mock data with edits kept in memory; only this module and api/mock/ import mock data

import type { ApiClient, DeviceApproval, ListFilter, NewCampaignInput, NewProjectInput, NewTargetInput } from "./client";
import type { BillingInterval, CheckoutStart, CheckoutSuccess, FindingStatus, PaymentConfirmation } from "@/types";
import type { Project, ReportFormat, SearchResult, WorkspaceSettings } from "@/types";
import * as mock from "@/data/mock";
import { PLANS } from "@/lib/plans";
import { payFromDemoCredit } from "./mock/mockCheckout";
import { approveMockDevice } from "./mock/mockDeviceFlow";
import { EMPTY_ANALYTICS, EMPTY_OVERVIEW } from "./mock/mockEmpty";
import { buildExport } from "./mock/mockExport";
import { filterCampaigns, filterFindings, filterReports, filterTargets } from "./mock/mockFilters";
import { delay, delayList, delayOne, getMockMode } from "./mock/mockMode";
import { buildCampaign, buildProject, buildTarget, getInitials } from "./mock/mockRecords";
import { searchMockRecords } from "./mock/mockSearch";
import { mockState, mustFind } from "./mock/mockState";
import { buildMockTranscript } from "./mock/mockTranscript";

export class MockApiClient implements ApiClient {
  async getOverview() {
    return delay(getMockMode() === "empty" ? EMPTY_OVERVIEW : mock.overview);
  }

  async listProjects() {
    return delayList(mockState.projects);
  }
  async getProject(id: string) {
    return delayOne(mockState.projects.find((project) => project.id === id));
  }
  async createProject(input: NewProjectInput) {
    const project = buildProject(input);
    mockState.projects = [project, ...mockState.projects];
    return delay(project, 250);
  }
  async updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "archived">>) {
    const project = mustFind(mockState.projects, id, "Project");
    Object.assign(project, patch);
    return delay({ ...project }, 250);
  }
  async deleteProject(id: string) {
    mockState.projects = mockState.projects.filter((project) => project.id !== id);
    return delay(undefined, 250);
  }

  async listTargets(filter?: ListFilter) {
    return delayList(filterTargets(mockState.targets, filter));
  }
  async getTarget(id: string) {
    return delayOne(mockState.targets.find((target) => target.id === id));
  }
  async createTarget(input: NewTargetInput) {
    const project = mustFind(mockState.projects, input.projectId, "Project");
    const target = buildTarget(input, project);
    mockState.targets = [target, ...mockState.targets];
    return delay(target, 250);
  }

  async listCampaigns(filter?: ListFilter) {
    return delayList(filterCampaigns(mockState.campaigns, filter));
  }
  async getCampaign(id: string) {
    return delayOne(mockState.campaigns.find((campaign) => campaign.id === id));
  }
  async getCampaignTimeline(id: string) {
    return delayList(mock.campaignTimelines[id] ?? []);
  }
  async getCampaignStats(id: string) {
    return delayOne(mock.campaignStats[id]);
  }
  async getCampaignTranscript(id: string) {
    const campaign = mockState.campaigns.find((candidate) => candidate.id === id);
    if (!campaign) return delayOne(null);
    const stats = mock.campaignStats[id]?.byStrategy ?? [];
    return delay(buildMockTranscript(campaign, stats, mockState.settings.sync.transcripts));
  }
  async createCampaign(input: NewCampaignInput) {
    const project = mustFind(mockState.projects, input.projectId, "Project");
    const target = mustFind(mockState.targets, input.targetId, "Target");
    const campaign = buildCampaign(input, project, target);
    mockState.campaigns = [campaign, ...mockState.campaigns];
    return delay(campaign, 250);
  }
  async renameCampaign(id: string, name: string) {
    const campaign = mustFind(mockState.campaigns, id, "Campaign");
    campaign.name = name.trim();
    return delay({ ...campaign }, 250);
  }
  async markCampaignReady(id: string) {
    const campaign = mustFind(mockState.campaigns, id, "Campaign");
    if (campaign.status !== "draft") throw new Error("Only a draft campaign can be marked ready.");
    if (campaign.strategies.length === 0) throw new Error("Pick at least one strategy first.");
    const target = mockState.targets.find((candidate) => candidate.id === campaign.targetId);
    if (!target?.authorized) throw new Error("The target is not marked authorized.");
    campaign.status = "ready";
    return delay({ ...campaign }, 250);
  }
  async unmarkCampaignReady(id: string) {
    const campaign = mustFind(mockState.campaigns, id, "Campaign");
    if (campaign.status !== "ready") throw new Error("Only a ready campaign can go back to draft.");
    campaign.status = "draft";
    return delay({ ...campaign }, 250);
  }
  async deleteCampaign(id: string) {
    mockState.campaigns = mockState.campaigns.filter((campaign) => campaign.id !== id);
    return delay(undefined, 250);
  }

  async listFindings(filter?: ListFilter) {
    return delayList(filterFindings(mockState.findings, filter));
  }
  async getFinding(id: string) {
    return delayOne(mockState.findings.find((finding) => finding.id === id));
  }
  async updateFindingStatus(id: string, status: FindingStatus) {
    const finding = mustFind(mockState.findings, id, "Finding");
    finding.status = status;
    return delay({ ...finding }, 200);
  }

  async listDevices(filter?: ListFilter) {
    return delayList(mockState.devices.filter((device) => !filter?.projectId || device.projectId === filter.projectId));
  }
  async getDevice(id: string) {
    return delayOne(mockState.devices.find((device) => device.id === id));
  }
  async renameDevice(id: string, name: string) {
    const device = mustFind(mockState.devices, id, "Device");
    device.name = name.trim();
    return delay({ ...device }, 250);
  }
  async revokeDevice(id: string) {
    mockState.devices = mockState.devices.filter((device) => device.id !== id);
    return delay(undefined, 250);
  }
  async approveDevice(userCode: string, projectId: string | null, approve: boolean): Promise<DeviceApproval> {
    return approveMockDevice(userCode, projectId, approve);
  }

  async getAnalytics() {
    return delay(getMockMode() === "empty" ? EMPTY_ANALYTICS : mock.analytics);
  }

  async listReports(filter?: ListFilter) {
    return delayList(filterReports(mock.reports, filter));
  }
  async exportReport(id: string, format: ReportFormat) {
    const report = mustFind(mock.reports, id, "Report");
    if (report.availability !== "cloud") throw new Error("This report lives on the local engine only.");
    return delay(buildExport(report, format, mockState.findings), 200);
  }

  async getSubscription() {
    return delay(mock.subscription);
  }
  async listPlans() {
    return delay(PLANS);
  }
  async listInvoices() {
    return delayList(mock.invoices);
  }
  async startCheckout(planId: "pro", interval: BillingInterval): Promise<CheckoutStart> {
    return payFromDemoCredit(planId, interval);
  }
  async confirmPayment(_result: CheckoutSuccess): Promise<PaymentConfirmation> {
    return delay({ status: "paid" as const, subscription: structuredClone(mock.subscription) });
  }

  async getSettings() {
    return delay(structuredClone(mockState.settings));
  }
  async updateSettings(patch: Partial<WorkspaceSettings>) {
    mockState.settings = {
      sync: { ...mockState.settings.sync, ...(patch.sync ?? {}), metadata: true },
      notifications: { ...mockState.settings.notifications, ...(patch.notifications ?? {}) },
    };
    return delay(structuredClone(mockState.settings), 200);
  }
  async getAccount() {
    return delay(mockState.account);
  }
  async updateAccount(patch: { name: string }) {
    const name = patch.name.trim();
    mockState.account = { ...mockState.account, name, avatarInitials: getInitials(name) };
    return delay(mockState.account, 200);
  }
  async listNotifications() {
    return delayList(mock.notifications);
  }

  async search(query: string): Promise<SearchResult[]> {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery) return delay([], 100);
    return delay(searchMockRecords(lowerQuery), 150);
  }
}
