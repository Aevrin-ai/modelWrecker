/*
  Catmint-style soft badge color classes. Catmint uses pill badges with a soft tint:
  bg-{color}-100 text-{color}-800 in light, bg-{color}-900 text-{color}-200 in dark
  (measured on the reference: e.g. bg rgb(219,234,254) / text rgb(30,64,175)).
  We centralize the color choice per enum value so every page stays consistent.

  Severity uses the dedicated severity token colors (critical/high/medium/low/info).
*/

import type {
  CampaignStatus,
  ConfidenceLevel,
  DeviceStatus,
  FindingStatus,
  Outcome,
  Severity,
  TargetStatus,
} from "@/types";

/** A soft pill color pair (light + dark). */
type Tone =
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "blue"
  | "indigo"
  | "green"
  | "emerald"
  | "slate"
  | "violet";

const TONE_CLASS: Record<Tone, string> = {
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  slate: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
};

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: "red",
  high: "orange",
  medium: "amber",
  low: "blue",
  info: "slate",
};

/** Severity dot / bar color using the severity design tokens. */
export const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  info: "bg-severity-info",
};

export const SEVERITY_HEX: Record<Severity, string> = {
  critical: "hsl(var(--sev-critical))",
  high: "hsl(var(--sev-high))",
  medium: "hsl(var(--sev-medium))",
  low: "hsl(var(--sev-low))",
  info: "hsl(var(--sev-info))",
};

export const FINDING_STATUS_TONE: Record<FindingStatus, Tone> = {
  open: "red",
  triaged: "amber",
  fixed: "green",
  "accepted-risk": "slate",
};

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, Tone> = {
  draft: "slate",
  ready: "yellow",
  queued: "indigo",
  running: "blue",
  completed: "green",
  failed: "red",
  stopped: "slate",
  syncing: "violet",
};

export const DEVICE_STATUS_TONE: Record<DeviceStatus, Tone> = {
  online: "green",
  offline: "slate",
  syncing: "violet",
};

export const TARGET_STATUS_TONE: Record<TargetStatus, Tone> = {
  active: "green",
  ready: "blue",
  idle: "slate",
  error: "red",
};

export const OUTCOME_TONE: Record<Outcome, Tone> = {
  success: "red", // a successful attack is a bad outcome for the defender
  partial: "amber",
  refused: "green",
  error: "slate",
};

export const CONFIDENCE_TONE: Record<ConfidenceLevel, Tone> = {
  reliable: "green",
  flaky: "amber",
  does_not_hold: "slate",
};

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  reliable: "Reliable",
  flaky: "Flaky",
  does_not_hold: "Does not hold",
};
