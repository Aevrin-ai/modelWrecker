import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataState, EmptyState, SkeletonCards } from "@/components/States";
import { CampaignRunsChart, SeverityDonut, StrategyBars, TrendLineChart } from "@/components/charts";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { AnalyticsStats } from "./analytics/AnalyticsStats";
import { LeaderboardCard } from "./analytics/LeaderboardCard";
import { TaxonomyCoverageCard } from "./analytics/TaxonomyCoverageCard";

export function Analytics() {
  const { activeProjectId } = useActiveProject();
  const analytics = useAsync(() => apiClient.getAnalytics(activeProjectId ?? undefined), [activeProjectId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Built from synced run metadata. Attack success rate is measured per attempt with Wilson 95% confidence intervals."
      />
      <DataState
        loading={analytics.loading}
        error={analytics.error}
        data={analytics.data}
        onRetry={analytics.refetch}
        errorTitle="Unable to load analytics."
        skeleton={<SkeletonCards count={4} className="sm:grid-cols-2 lg:grid-cols-4" />}
        isEmpty={(summary) => summary.totalAttempts === 0}
        empty={
          <EmptyState
            icon={BarChart3}
            title="No runs to analyze yet"
            description="Analytics appear after your local engine syncs its first campaign results."
          />
        }
      >
        {(summary) => (
          <div className="space-y-4">
            <AnalyticsStats summary={summary} />

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Attack success rate over time</CardTitle>
                  <CardDescription>Lower is better for the target.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendLineChart data={summary.successRateOverTime} asPercent valueLabel="ASR" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Findings by severity</CardTitle>
                  <CardDescription>All verified findings in scope.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SeverityDonut breakdown={summary.severityBreakdown} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Findings over time</CardTitle>
                  <CardDescription>New verified findings per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendLineChart data={summary.findingsOverTime} valueLabel="Findings" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Campaign activity</CardTitle>
                  <CardDescription>Campaigns and runs per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CampaignRunsChart data={summary.campaignActivity} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>ASR by strategy</CardTitle>
                  <CardDescription>Which techniques get through most often.</CardDescription>
                </CardHeader>
                <CardContent>
                  <StrategyBars data={summary.byStrategy} />
                </CardContent>
              </Card>
              <TaxonomyCoverageCard byTaxonomy={summary.byTaxonomy} />
            </div>

            <LeaderboardCard summary={summary} />
          </div>
        )}
      </DataState>
    </div>
  );
}
