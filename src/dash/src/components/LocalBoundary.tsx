/*
  The local-vs-cloud boundary made visible. The dashboard is a control plane: it never
  runs attacks or inference, and detailed evidence stays on the local engine unless the
  user opts in to sync it. These components make that explicit on screen.
  Source of truth: docs/architecture/local-cloud.md and docs/architecture/data-flow.md.
*/

import type { ReactNode } from "react";
import { ArrowDownUp, Cloud, HardDrive, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shown where evidence or a transcript would be, when it has not been synced from the device.
 * Detail syncs only when it is on in Settings; runs synced earlier are sent again with it on the
 * next `modelwrecker sync`.
 */
export function EvidenceLocalNotice({
  className,
  kind = "evidence",
}: {
  className?: string;
  kind?: "evidence" | "transcript";
}) {
  const setting = kind === "evidence" ? "Detailed evidence" : "Full attack transcripts";
  return (
    <div className={cn("flex items-start gap-3 rounded-md border border-dashed bg-muted/40 p-5", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Lock className="size-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {kind === "evidence" ? "Detailed evidence" : "The attack transcript"} remains on your local machine.
        </p>
        <p className="max-w-prose text-sm text-muted-foreground">
          {kind === "evidence"
            ? "The cloud holds finding metadata only (severity, strategy, success rate, timestamps). The prompt sent and the model reply live on the engine that produced this finding."
            : "The cloud holds counts only. Every prompt sent and every model reply live on the engine that ran this campaign."}{" "}
          To see them here, turn on <span className="font-medium text-foreground">{setting}</span> in Settings, then run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">modelwrecker sync</code> on that machine.
          Runs synced earlier are sent again with the detail.
        </p>
      </div>
    </div>
  );
}

/** A small inline chip stating an action runs on the local engine, not the cloud. */
export function RunsLocallyChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <HardDrive className="size-3.5" />
      Runs on your local engine
    </span>
  );
}

/** A reusable callout explaining the control-plane boundary. */
export function ControlPlaneCallout({
  title = "This is a control plane",
  children,
  className,
}: {
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 rounded-md border bg-muted/40 p-4", className)}>
      <ShieldCheck className="mt-0.5 size-5 shrink-0" />
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground">
          {children ??
            "The dashboard manages your red-team work and shows synced results. It never runs attacks, model calls, or tools. That work runs on your local ModelWrecker engine, which syncs metadata back here."}
        </p>
      </div>
    </div>
  );
}

const CLOUD_ITEMS = ["Account and sign-in", "Projects and targets", "Campaign metadata", "Finding metadata", "Analytics", "Device status", "Subscription"];
const LOCAL_ITEMS = ["Attack engine", "LLM calls", "Payload generation", "Judging", "Sensitive transcripts", "Detailed evidence"];

/**
 * The cloud vs local split as a two-panel diagram. `evidenceSynced` reflects the
 * user's sync setting so the picture never claims evidence is local when it is not.
 */
export function CloudLocalDiagram({
  evidenceSynced = false,
  className,
}: {
  evidenceSynced?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]", className)}>
      <div className="rounded-md border p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-background">
            <Cloud className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Aevrin Cloud</p>
            <p className="text-xs text-muted-foreground">Control plane - manage and view</p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {CLOUD_ITEMS.map((i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-muted-foreground" />
              {i}
            </li>
          ))}
          {evidenceSynced && (
            <li className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-warning" />
              Detailed evidence (you opted in)
            </li>
          )}
        </ul>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground md:flex-col">
        <ArrowDownUp className="size-4" />
        <span className="text-center">{evidenceSynced ? "Metadata and evidence" : "Metadata only"}</span>
      </div>

      <div className="rounded-md border bg-zinc-900 p-4 text-zinc-50 dark:bg-zinc-900">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-zinc-800">
            <HardDrive className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Your machine</p>
            <p className="text-xs text-zinc-400">ModelWrecker engine in Docker - compute</p>
          </div>
        </div>
        <ul className="space-y-1.5">
          {LOCAL_ITEMS.filter((i) => !(evidenceSynced && i === "Detailed evidence")).map((i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-zinc-400" />
              {i}
            </li>
          ))}
          {evidenceSynced && (
            <li className="flex items-center gap-2 text-sm">
              <span className="size-1.5 rounded-full bg-zinc-400" />
              Detailed evidence (a copy is also synced)
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
