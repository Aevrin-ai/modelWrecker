import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EvidenceLocalNoticeProps {
  className?: string;
  kind?: "evidence" | "transcript";
}

// shown where unsynced evidence or a transcript would be; the next `modelwrecker sync` with the setting on sends it
export function EvidenceLocalNotice({ className, kind = "evidence" }: EvidenceLocalNoticeProps) {
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
