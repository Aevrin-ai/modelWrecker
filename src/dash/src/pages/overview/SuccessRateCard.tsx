import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendLineChart } from "@/components/charts";
import { DataState } from "@/components/States";
import { formatPercent } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { AnalyticsSummary } from "@/types";

export interface SuccessRateCardProps {
  analytics: AsyncState<AnalyticsSummary>;
}

export function SuccessRateCard({ analytics }: SuccessRateCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Attack success rate</CardTitle>
        <CardDescription>
          {analytics.data && analytics.data.totalAttempts > 0
            ? `${formatPercent(analytics.data.asr)} overall (95% CI ${formatPercent(analytics.data.asrCiLow)} - ${formatPercent(analytics.data.asrCiHigh)})`
            : "Share of attempts that succeeded, last 14 days."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={analytics.loading}
          error={analytics.error}
          data={analytics.data}
          onRetry={analytics.refetch}
          errorTitle="Unable to load the success-rate trend."
          skeleton={<Skeleton className="h-[220px] w-full" />}
        >
          {(summary) => <TrendLineChart data={summary.successRateOverTime} asPercent height={220} valueLabel="Success rate" />}
        </DataState>
      </CardContent>
    </Card>
  );
}
