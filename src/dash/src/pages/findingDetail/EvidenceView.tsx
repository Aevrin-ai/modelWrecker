import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import type { Finding } from "@/types";
import { CodeBlock } from "./CodeBlock";

export interface EvidenceViewProps {
  finding: Finding;
}

export function EvidenceView({ finding }: EvidenceViewProps) {
  const evidence = finding.evidence;
  return (
    <div className="space-y-4">
      {evidence.objective && (evidence.objective.title || evidence.objective.successCriteria) && (
        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-muted-foreground">Objective</p>
          <p>{evidence.objective.title}</p>
          {evidence.objective.successCriteria && (
            <p className="text-xs text-muted-foreground">Counts as success when: {evidence.objective.successCriteria}</p>
          )}
        </div>
      )}
      {evidence.transformChain && evidence.transformChain.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Transforms:</span>
          {evidence.transformChain.map((transform) => (
            <Badge key={transform} tone="bg-secondary text-secondary-foreground" className="font-mono">
              {transform}
            </Badge>
          ))}
        </div>
      )}
      {evidence.payload && (
        <CodeBlock label="Prompt sent" text={evidence.payload} />
      )}
      {evidence.targetResponse && (
        <CodeBlock label="Model reply" text={evidence.targetResponse} tone="reply" />
      )}
      {evidence.targetReasoning && <CodeBlock label="Model reasoning" text={evidence.targetReasoning} />}
      {evidence.judge && (evidence.judge.rationale || evidence.judge.outcome) && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Judge verdict</p>
          <p className="rounded-lg border p-3 text-sm">
            <span className="font-medium capitalize">{evidence.judge.outcome || "unknown"}</span>
            <span className="text-muted-foreground"> · score {evidence.judge.score}/10</span>
            {evidence.judge.rationale && <span className="mt-1 block text-muted-foreground">{evidence.judge.rationale}</span>}
          </p>
        </div>
      )}
      {evidence.attackSequence && evidence.attackSequence.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Attack sequence</p>
          <div className="space-y-2">
            {evidence.attackSequence.map((step) => (
              <div key={step.step} className="rounded-lg border p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {step.role}
                </p>
                <p className="text-sm">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {evidence.toolCalls && evidence.toolCalls.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Observed tool calls</p>
          {evidence.toolCalls.map((toolCall, i) => (
            <pre key={i} className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {toolCall.name}({typeof toolCall.args === "string" ? toolCall.args : JSON.stringify(toolCall.args)})
            </pre>
          ))}
        </div>
      )}
      {evidence.reproductionSteps && <CodeBlock label="Reproduce locally" text={evidence.reproductionSteps} tone="cmd" />}
      <p className="text-xs text-muted-foreground">
        Synced from your device{evidence.syncedAt ? ` ${formatDateTime(evidence.syncedAt)}` : ""}. Secrets were redacted before upload.
      </p>
    </div>
  );
}
