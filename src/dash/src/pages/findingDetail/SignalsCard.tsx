import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, humanize } from "@/lib/format";
import type { SignalResult } from "@/types";

export interface SignalsCardProps {
  signals: SignalResult[];
}

export function SignalsCard({ signals }: SignalsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-brand" />
          Judge signals
        </CardTitle>
        <CardDescription>
          The multi-signal judge combines detectors; no single signal invents a finding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((signal, i) => (
          <div key={i} className="flex items-center gap-3">
            <span
              className={`size-2 shrink-0 rounded-full ${signal.hit ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{humanize(signal.signal)}</p>
              <p className="truncate text-xs text-muted-foreground">{signal.detail}</p>
            </div>
            <span className="text-sm font-medium tabular-nums">{formatPercent(signal.score, 0)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
