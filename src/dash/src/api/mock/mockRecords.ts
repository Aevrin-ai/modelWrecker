import type { NewCampaignInput, NewProjectInput, NewTargetInput } from "../client";
import type { Campaign, Device, Project, Target } from "@/types";
import { newId } from "./mockState";

export function buildProject(input: NewProjectInput): Project {
  return {
    id: newId("prj"),
    name: input.name.trim(),
    description: input.description.trim(),
    archived: false,
    createdAt: new Date().toISOString(),
    lastActivityAt: null,
    counts: { targets: 0, campaigns: 0, findings: 0, devices: 0 },
    riskSummary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  };
}

export function buildTarget(input: NewTargetInput, project: Project): Target {
  return {
    id: newId("tgt"),
    name: input.name.trim(),
    type: input.type,
    provider: input.provider.trim(),
    endpoint: input.endpoint.trim(),
    model: input.model.trim(),
    status: "ready",
    projectId: project.id,
    projectName: project.name,
    authorized: input.authorized,
    capabilities: ["send_message", "get_metadata"],
    lastTestedAt: null,
    campaignCount: 0,
    topSeverity: null,
    createdAt: new Date().toISOString(),
  };
}

export function buildCampaign(input: NewCampaignInput, project: Project, target: Target): Campaign {
  return {
    id: newId("cmp"),
    name: input.name.trim(),
    status: "draft",
    projectId: project.id,
    projectName: project.name,
    targetId: target.id,
    targetName: target.name,
    deviceId: null,
    deviceName: null,
    objectiveCount: input.objectiveCount,
    strategies: input.strategies,
    stopCondition: input.stopCondition,
    concurrency: input.concurrency,
    budget: { maxAttempts: input.maxAttempts, maxTokens: null, maxSeconds: null, maxObjectives: input.objectiveCount },
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
    attemptCount: 0,
    successfulAttacks: 0,
    findingCount: 0,
    successRate: 0,
    createdAt: new Date().toISOString(),
  };
}

// an approved code adds a new online device, as if the engine had polled and received its token
export function buildApprovedDevice(code: string, project: Project | null): Device {
  const now = new Date().toISOString();
  return {
    id: newId("dev"),
    name: `New engine ${code}`,
    status: "online",
    engineVersion: "0.0.1",
    os: "Unknown",
    lastSeenAt: now,
    lastSyncAt: null,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    engineHealthy: true,
    fingerprint: Math.random().toString(16).slice(2, 14).replace(/(.{4})(?=.)/g, "$1-"),
  };
}

// "Ada Lovelace" -> "AL"
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
