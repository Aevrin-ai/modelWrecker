/*
  Every synced attack attempt of a campaign, run by run. Only present when the account turned on
  "Full attack transcripts" in Settings and the run was synced with it (issue #28). The text is what
  the engine sent: already redacted for secrets and capped in length.
*/

import { ChevronRight, ListOrdered } from "lucide-react";
import { OutcomeBadge } from "@/components/StatusBadges";
import { EvidenceLocalNotice } from "@/components/LocalBoundary";
import { EmptyState } from "@/components/States";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Outcome, RunTranscript, TranscriptAttempt } from "@/types";

const OUTCOMES: Outcome[] = ["success", "partial", "refused", "error"];
const isOutcome = (v: string): v is Outcome => (OUTCOMES as string[]).includes(v);

export function RunTranscripts({ runs }: { runs: RunTranscript[] }) {
  if (runs.length === 0) {
    return <EmptyState icon={ListOrdered} title="No runs yet" description="Attempts appear after the engine syncs a run." />;
  }
  if (runs.every((r) => !r.synced)) return <EvidenceLocalNotice kind="transcript" />;
  return (
    <div className="space-y-6">
      {runs.map((run) => (
        <section key={run.runId} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-xs font-medium">runs/{run.runName}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(run.startedAt)} · {formatNumber(run.attemptCount)} attempt(s)
            </p>
          </div>
          {!run.synced ? (
            <EvidenceLocalNotice kind="transcript" />
          ) : (
            <>
              <ol className="divide-y rounded-lg border">
                {run.attempts.map((a) => (
                  <AttemptRow key={a.index} attempt={a} />
                ))}
              </ol>
              {run.truncated && (
                <p className="text-xs text-muted-foreground">
                  The run had more attempts than fit in one sync. The full list is in the local run folder.
                </p>
              )}
            </>
          )}
        </section>
      ))}
    </div>
  );
}

function AttemptRow({ attempt: a }: { attempt: TranscriptAttempt }) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">#{a.index}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{a.strategy || "unknown"}</span>
          {isOutcome(a.outcome) ? (
            <OutcomeBadge outcome={a.outcome} />
          ) : (
            <span className="text-xs text-muted-foreground">{a.outcome}</span>
          )}
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{a.score}/10</span>
        </summary>
        <div className="space-y-3 border-t bg-muted/20 px-4 py-3">
          {a.objective && (
            <p className="text-xs text-muted-foreground">
              Objective: <span className="text-foreground">{a.objective}</span>
            </p>
          )}
          <Text label="Prompt sent" text={a.payload} />
          <Text label="Model reply" text={a.response} reply />
        </div>
      </details>
    </li>
  );
}

function Text({ label, text, reply }: { label: string; text: string; reply?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        className={`max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs ${
          reply ? "bg-brand-muted/40" : "bg-muted"
        }`}
      >
        {text || "(empty)"}
      </pre>
    </div>
  );
}
