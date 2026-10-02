/*
  Static UI constants: navigation, severity ordering, and the display metadata the
  dashboard needs that is not part of the synced data model. Kept out of components so
  there is one source of truth. No statistics here - those come from the API layer.
*/

import type {
  CampaignStatus,
  DeviceStatus,
  FindingStatus,
  Outcome,
  Severity,
  TargetStatus,
  TargetType,
} from "@/types";
import {
  LayoutDashboard,
  FolderKanban,
  Crosshair,
  Swords,
  ShieldAlert,
  MonitorSmartphone,
  BarChart3,
  FileText,
  PlugZap,
  Settings,
  CreditCard,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Grouping header for the sidebar. */
  group: "Monitor" | "Manage" | "Account";
}

/** Primary sidebar navigation. Order matters. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", to: "/", icon: LayoutDashboard, group: "Monitor" },
  { label: "Analytics", to: "/analytics", icon: BarChart3, group: "Monitor" },
  { label: "Findings", to: "/findings", icon: ShieldAlert, group: "Monitor" },
  { label: "Reports", to: "/reports", icon: FileText, group: "Monitor" },

  { label: "Projects", to: "/projects", icon: FolderKanban, group: "Manage" },
  { label: "Targets", to: "/targets", icon: Crosshair, group: "Manage" },
  { label: "Campaigns", to: "/campaigns", icon: Swords, group: "Manage" },
  { label: "Devices", to: "/devices", icon: MonitorSmartphone, group: "Manage" },

  { label: "Connect engine", to: "/connect", icon: PlugZap, group: "Account" },
  { label: "Billing", to: "/billing", icon: CreditCard, group: "Account" },
  { label: "Settings", to: "/settings", icon: Settings, group: "Account" },
  { label: "Account", to: "/account", icon: UserCircle, group: "Account" },
];

export const NAV_GROUPS: NavItem["group"][] = ["Monitor", "Manage", "Account"];

/** Severities from most to least severe - the canonical display order. */
export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

/** Short human labels for enums that are stored as snake_case or kebab-case. */
export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Open",
  triaged: "Triaged",
  fixed: "Fixed",
  "accepted-risk": "Accepted risk",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  ready: "Ready for engine",
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
  syncing: "Syncing",
};

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  syncing: "Syncing",
};

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  active: "Active",
  ready: "Ready",
  idle: "Idle",
  error: "Error",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  refused: "Refused",
  partial: "Partial",
  success: "Success",
  error: "Error",
};

/** Target-type display names (chat / agent / rag / mcp are the real engine types). */
export const TARGET_TYPE_LABEL: Record<TargetType, string> = {
  chat: "Chat",
  agent: "Agent",
  rag: "RAG",
  mcp: "MCP",
};

/** Human description of each target type, for tooltips and detail pages. */
export const TARGET_TYPE_DESCRIPTION: Record<TargetType, string> = {
  chat: "A single-turn or multi-turn conversational model.",
  agent: "A tool-using agent whose tool calls can be observed.",
  rag: "A retrieval-augmented assistant that ingests documents.",
  mcp: "An agent connected to tools over the Model Context Protocol.",
};

/**
 * Strategies registered in the engine (docs/attack-engine/STRATEGIES.md, `modelwrecker
 * strategies`). `targets` lists the target types each one applies to. The dashboard only
 * records the choice in campaign config; the local engine runs them.
 */
export const STRATEGIES: { id: string; targets: TargetType[]; advanced?: boolean }[] = [
  { id: "direct_jailbreak", targets: ["chat", "agent", "rag", "mcp"] },
  { id: "prompt_extraction", targets: ["chat", "agent", "rag", "mcp"] },
  { id: "best_of_n", targets: ["chat", "agent", "rag", "mcp"] },
  { id: "prefill", targets: ["chat", "agent"] },
  { id: "many_shot", targets: ["chat", "agent", "rag"] },
  { id: "crescendo", targets: ["chat", "agent", "rag", "mcp"] },
  { id: "encoded_jailbreak", targets: ["chat", "agent", "rag", "mcp"] },
  { id: "pyrit_send", targets: ["chat", "agent", "rag"], advanced: true },
  { id: "pyrit_pair", targets: ["chat", "agent", "rag"], advanced: true },
  { id: "pyrit_tap", targets: ["chat", "agent", "rag"], advanced: true },
  { id: "garak_probe", targets: ["chat"], advanced: true },
  { id: "tool_misuse", targets: ["agent", "mcp"] },
  { id: "rag_injection", targets: ["rag"] },
  { id: "mcp_tool_poisoning", targets: ["mcp"] },
];

/** Campaign stop conditions (`--stop-on complete|first_finding|budget`). */
export const STOP_CONDITION_LABEL: Record<"complete" | "first_finding" | "budget", string> = {
  complete: "Run all objectives",
  first_finding: "Stop on first finding",
  budget: "Stop when budget is spent",
};

/** Report formats the engine's `analyze` command writes. */
export const REPORT_FORMATS = ["html", "json", "csv"] as const;
