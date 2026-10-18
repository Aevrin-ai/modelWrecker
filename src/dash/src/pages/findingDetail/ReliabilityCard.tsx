import { FlaskConical } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ConfidenceBadge } from "@/components/StatusBadges";
import { formatPercent } from "@/lib/format";
import type { ReliabilityResult } from "@/types";
import { Metric } from "./Metric";

export interface ReliabilityCardProps {
  reliability: ReliabilityResult;
}

export function ReliabilityCard({ reliability }: ReliabilityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-brand" />
          Reliability
        </CardTitle>
        <CardDescription>
          Verified by replaying the attack {reliability.attemptsRun} times. A one-shot success is luck - this is
          the measured success rate with a Wilson 95% confidence interval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Success rate" value={formatPercent(reliability.successRate, 0)} />
          <Metric label="Successes" value={`${reliability.successes}/${reliability.attemptsRun}`} />
          <Metric label="Partials" value={String(reliability.partials)} />
          <Metric
            label="95% CI"
            value={`${formatPercent(reliability.ciLow, 0)} - ${formatPercent(reliability.ciHigh, 0)}`}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Confidence interval</span>
            <span className="tabular-nums">
              {formatPercent(reliability.ciLow, 0)} - {formatPercent(reliability.ciHigh, 0)}
            </span>
          </div>
          <Progress value={reliability.successRate} indicatorClassName="bg-brand" />
        </div>
        <div className="flex flex-wrap gap-2">
          <ConfidenceBadge level={reliability.confidence} />
          {reliability.highVariance && (
            <Badge tone="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              High variance
            </Badge>
          )}
          {reliability.backendPinned && (
            <Badge tone="bg-secondary text-secondary-foreground">Backend pinned</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
