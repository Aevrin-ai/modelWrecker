import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STOP_CONDITION_LABEL } from "@/lib/constants";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import type { Campaign } from "@/types";

export interface CampaignConfigCardProps {
  campaign: Campaign;
}

export function CampaignConfigCard({ campaign }: CampaignConfigCardProps) {
  const facts: [string, string][] = [
    ["Target", campaign.targetName],
    ["Device", campaign.deviceName ?? "Not picked up yet"],
    ["Project", campaign.projectName],
    ["Started", formatDateTime(campaign.startedAt)],
    ["Completed", formatDateTime(campaign.completedAt)],
    ["Duration", formatDuration(campaign.durationSeconds)],
    ["Stop condition", STOP_CONDITION_LABEL[campaign.stopCondition]],
    ["Concurrency", String(campaign.concurrency)],
    ["Objectives", String(campaign.objectiveCount)],
    ["Max attempts", campaign.budget.maxAttempts == null ? "No limit" : formatNumber(campaign.budget.maxAttempts)],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
        <CardDescription>Read by the local engine when it picks the campaign up.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {campaign.strategies.map((strategy) => (
            <span key={strategy} className="rounded-md border px-2 py-1 font-mono text-xs">
              {strategy}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
