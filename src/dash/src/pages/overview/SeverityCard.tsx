import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityDonut } from "@/components/charts";
import { DataState } from "@/components/States";
import type { AsyncState } from "@/hooks/useAsync";
import type { AnalyticsSummary } from "@/types";

export interface SeverityCardProps {
  analytics: AsyncState<AnalyticsSummary>;
}

export function SeverityCard({ analytics }: SeverityCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Findings by severity</CardTitle>
        <CardDescription>All findings in scope.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={analytics.loading}
          error={analytics.error}
          data={analytics.data}
          onRetry={analytics.refetch}
          errorTitle="Unable to load the severity breakdown."
          skeleton={<Skeleton className="mx-auto size-44 rounded-full" />}
        >
          {(summary) => <SeverityDonut breakdown={summary.severityBreakdown} />}
        </DataState>
      </CardContent>
    </Card>
  );
}
