/*
  Domain-specific badges that map an engine enum to a Catmint soft pill. One place
  so severity/status colors never drift between pages.
*/

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CAMPAIGN_STATUS_TONE,
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  DEVICE_STATUS_TONE,
  FINDING_STATUS_TONE,
  OUTCOME_TONE,
  SEVERITY_DOT,
  SEVERITY_TONE,
  TARGET_STATUS_TONE,
  toneClass,
} from "@/lib/badges";
import {
  CAMPAIGN_STATUS_LABEL,
  DEVICE_STATUS_LABEL,
  FINDING_STATUS_LABEL,
  OUTCOME_LABEL,
  TARGET_STATUS_LABEL,
  TARGET_TYPE_LABEL,
} from "@/lib/constants";
import type {
  CampaignStatus,
  ConfidenceLevel,
  DeviceStatus,
  FindingStatus,
  Outcome,
  Severity,
  TargetStatus,
  TargetType,
} from "@/types";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge tone={toneClass(SEVERITY_TONE[severity])} className={cn("capitalize", className)}>
      <span className={cn("size-1.5 rounded-full", SEVERITY_DOT[severity])} />
      {severity}
    </Badge>
  );
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return <Badge tone={toneClass(FINDING_STATUS_TONE[status])}>{FINDING_STATUS_LABEL[status]}</Badge>;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const pulse = status === "running" || status === "syncing";
  return (
    <Badge tone={toneClass(CAMPAIGN_STATUS_TONE[status])}>
      {pulse && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {CAMPAIGN_STATUS_LABEL[status]}
    </Badge>
  );
}

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  return (
    <Badge tone={toneClass(DEVICE_STATUS_TONE[status])}>
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          status === "online" && "animate-pulse",
        )}
      />
      {DEVICE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function TargetStatusBadge({ status }: { status: TargetStatus }) {
  return <Badge tone={toneClass(TARGET_STATUS_TONE[status])}>{TARGET_STATUS_LABEL[status]}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <Badge tone={toneClass(OUTCOME_TONE[outcome])}>{OUTCOME_LABEL[outcome]}</Badge>;
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return <Badge tone={toneClass(CONFIDENCE_TONE[level])}>{CONFIDENCE_LABEL[level]}</Badge>;
}

export function TargetTypeBadge({ type }: { type: TargetType }) {
  return (
    <Badge tone="bg-secondary text-secondary-foreground" className="font-mono uppercase">
      {TARGET_TYPE_LABEL[type]}
    </Badge>
  );
}
