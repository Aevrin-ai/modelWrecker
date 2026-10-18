import { Card } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Campaign } from "@/types";

export interface CampaignMetricsProps {
  campaign: Campaign;
}

export function CampaignMetrics({ campaign }: CampaignMetricsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["Attack attempts", formatNumber(campaign.attemptCount)],
        ["Successful attacks", formatNumber(campaign.successfulAttacks)],
        ["Findings", String(campaign.findingCount)],
        ["Success rate", formatPercent(campaign.successRate, 1)],
      ].map(([label, value]) => (
        <Card key={label} className="p-6">
          <p className="text-sm font-medium tracking-tight">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        </Card>
      ))}
    </div>
  );
}
