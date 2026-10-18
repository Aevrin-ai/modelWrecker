import type { Account, Campaign, Device, Finding, Project, Target, WorkspaceSettings } from "@/types";
import * as mock from "@/data/mock";

interface MockState {
  projects: Project[];
  targets: Target[];
  campaigns: Campaign[];
  devices: Device[];
  findings: Finding[];
  settings: WorkspaceSettings;
  account: Account;
  usedCodes: Set<string>;
}

// copies, so edits made during the session never touch the source module
export const mockState: MockState = {
  projects: mock.projects.map((project) => ({ ...project })),
  targets: mock.targets.map((target) => ({ ...target })),
  campaigns: mock.campaigns.map((campaign) => ({ ...campaign })),
  devices: mock.devices.map((device) => ({ ...device })),
  findings: mock.findings.map((finding) => ({ ...finding })),
  settings: structuredClone(mock.settings),
  account: { ...mock.account },
  usedCodes: new Set<string>(),
};

// the real alphabet has no 0, O, 1, or I, but the mock accepts any XXXX-XXXX code
export const USER_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function matchesQuery(haystack: string[], query?: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return haystack.some((value) => value.toLowerCase().includes(lowerQuery));
}

export function mustFind<T extends { id: string }>(items: T[], id: string, what: string): T {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`${what} not found`);
  return item;
}
