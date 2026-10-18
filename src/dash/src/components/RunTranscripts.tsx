// every synced attempt of a campaign, run by run; the text is what the engine sent, already redacted and capped

import { ListOrdered } from "lucide-react";
import { EvidenceLocalNotice } from "@/components/LocalBoundary";
import { EmptyState } from "@/components/States";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { RunTranscript } from "@/types";
import { AttemptRow } from "./transcripts/AttemptRow";

export interface RunTranscriptsProps {
  runs: RunTranscript[];
}

export function RunTranscripts({ runs }: RunTranscriptsProps) {
  if (runs.length === 0) {
    return <EmptyState icon={ListOrdered} title="No runs yet" description="Attempts appear after the engine syncs a run." />;
  }
  if (runs.every((run) => !run.synced)) return <EvidenceLocalNotice kind="transcript" />;
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
                {run.attempts.map((attempt) => (
                  <AttemptRow key={attempt.index} attempt={attempt} />
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

