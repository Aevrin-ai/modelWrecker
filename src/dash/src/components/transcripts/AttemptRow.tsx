import { ChevronRight } from "lucide-react";
import { OutcomeBadge } from "@/components/StatusBadges";
import type { Outcome, TranscriptAttempt } from "@/types";
import { TranscriptText } from "./TranscriptText";

const OUTCOMES: Outcome[] = ["success", "partial", "refused", "error"];
const isOutcome = (value: string): value is Outcome => (OUTCOMES as string[]).includes(value);

export interface AttemptRowProps {
  attempt: TranscriptAttempt;
}

export function AttemptRow({ attempt }: AttemptRowProps) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">#{attempt.index}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{attempt.strategy || "unknown"}</span>
          {isOutcome(attempt.outcome) ? (
            <OutcomeBadge outcome={attempt.outcome} />
          ) : (
            <span className="text-xs text-muted-foreground">{attempt.outcome}</span>
          )}
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{attempt.score}/10</span>
        </summary>
        <div className="space-y-3 border-t bg-muted/20 px-4 py-3">
          {attempt.objective && (
            <p className="text-xs text-muted-foreground">
              Objective: <span className="text-foreground">{attempt.objective}</span>
            </p>
          )}
          <TranscriptText label="Prompt sent" text={attempt.payload} />
          <TranscriptText label="Model reply" text={attempt.response} isReply />
        </div>
      </details>
    </li>
  );
}
