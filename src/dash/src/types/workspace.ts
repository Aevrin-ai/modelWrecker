import type { Capability, DeviceStatus, Severity, TargetStatus, TargetType } from "./engine";

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
  os: string; // e.g. macOS 14.5, Ubuntu 22.04, Windows 11
  lastSeenAt: string;
  lastSyncAt: string | null; // last metadata push to the control plane
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
