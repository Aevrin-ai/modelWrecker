import { Link } from "react-router-dom";
import { Swords } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { CampaignStatusBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { formatNumber } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { Campaign } from "@/types";

export interface RecentCampaignsCardProps {
  campaigns: AsyncState<Campaign[]>;
}

export function RecentCampaignsCard({ campaigns }: RecentCampaignsCardProps) {
  return (
    <Card className="xl:col-span-2">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Recent campaigns</CardTitle>
          <CardDescription>Configured here, executed by your local engine.</CardDescription>
        </div>
        <Link to="/campaigns" className={buttonClasses("outline", "sm")}>
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <DataState
          loading={campaigns.loading}
          error={campaigns.error}
          data={campaigns.data}
          onRetry={campaigns.refetch}
          errorTitle="Unable to load campaigns."
          skeleton={<SkeletonRows rows={5} cols={4} />}
          empty={
            <EmptyState
              icon={Swords}
              title="No campaigns yet"
              description="Create a campaign, then mark it ready for your local engine."
              action={
                <Link to="/campaigns?new=1" className={buttonClasses("default", "sm")}>
                  New campaign
                </Link>
              }
            />
          }
        >
          {(list) => (
            <ul className="divide-y rounded-md border">
              {list.slice(0, 5).map((campaign) => (
                <li key={campaign.id}>
                  <Link to={`/campaigns/${campaign.id}`} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{campaign.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {campaign.targetName} - {campaign.findingCount} findings - {formatNumber(campaign.attemptCount)} attempts
                      </p>
                    </div>
                    <CampaignStatusBadge status={campaign.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DataState>
      </CardContent>
    </Card>
  );
}
