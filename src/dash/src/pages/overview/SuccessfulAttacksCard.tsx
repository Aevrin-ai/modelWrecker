import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CampaignActivityChart } from "@/components/charts";
import { DataState } from "@/components/States";
import type { AsyncState } from "@/hooks/useAsync";
import type { AnalyticsSummary } from "@/types";

export interface SuccessfulAttacksCardProps {
  analytics: AsyncState<AnalyticsSummary>;
}

export function SuccessfulAttacksCard({ analytics }: SuccessfulAttacksCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Successful attacks</CardTitle>
        <CardDescription>Per day, synced from your engines.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={analytics.loading}
          error={analytics.error}
          data={analytics.data}
          onRetry={analytics.refetch}
          errorTitle="Unable to load activity."
          skeleton={<Skeleton className="h-[220px] w-full" />}
        >
          {(summary) => <CampaignActivityChart data={summary.campaignActivity} height={220} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
