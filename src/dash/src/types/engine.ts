// engine enums, verbatim from src/modelwrecker/data.py

export type Outcome = "refused" | "partial" | "success" | "error";

export type ConfidenceLevel = "reliable" | "flaky" | "does_not_hold";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type FindingStatus = "open" | "triaged" | "fixed" | "accepted-risk";

export type TargetType = "chat" | "agent" | "rag" | "mcp";

// capabilities a target declares (docs/targets/OVERVIEW.md)
export type Capability =
  | "send_message"
  | "send_multiturn"
  | "upload_image"
  | "call_tool"
  | "observe_tool_call"
  | "reset_session"
  | "get_metadata"
  | "ingest_document";

// a control-plane lifecycle: the dashboard only reaches "ready", the local engine moves it further
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

export interface TaxonomyRef {
  framework: "owasp_llm" | "owasp_asi" | "owasp_mcp" | "mitre_atlas" | string;
  id: string; // e.g. LLM01, ASI01, MCP03, AML.T0051
  edition?: string | null; // "2025" | "2026"
  title?: string | null;
}
