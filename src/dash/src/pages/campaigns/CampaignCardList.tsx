import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { CampaignStatusBadge } from "@/components/StatusBadges";
import { formatNumber, formatPercent } from "@/lib/format";
import type { Campaign } from "@/types";

export interface CampaignCardListProps {
  campaigns: Campaign[];
}

export function CampaignCardList({ campaigns }: CampaignCardListProps) {
  return (
      <div className="space-y-3 md:hidden">
        {campaigns.map((campaign) => (
          <Link key={campaign.id} to={`/campaigns/${campaign.id}`}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{campaign.name}</p>
                <CampaignStatusBadge status={campaign.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {campaign.targetName} - {campaign.strategies.length} strategies
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <span>
                  <span className="block text-muted-foreground">Attempts</span>
                  {formatNumber(campaign.attemptCount)}
                </span>
                <span>
                  <span className="block text-muted-foreground">Findings</span>
                  {campaign.findingCount}
                </span>
                <span>
                  <span className="block text-muted-foreground">ASR</span>
                  {formatPercent(campaign.successRate, 0)}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
  );
}
