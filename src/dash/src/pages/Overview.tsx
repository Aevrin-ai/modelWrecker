import { Link } from "react-router-dom";
import {
  Swords,
  Crosshair,
  ShieldAlert,
  AlertOctagon,
  Activity,
  MonitorSmartphone,
  RefreshCw,
  Repeat,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, StatCardSkeleton } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampaignActivityChart, SeverityDonut, TrendLineChart } from "@/components/charts";
import { CampaignStatusBadge, SeverityBadge, FindingStatusBadge } from "@/components/StatusBadges";
import { CloudLocalDiagram } from "@/components/LocalBoundary";
import { EngineStatusCard } from "@/components/EngineStatus";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { formatNumber, formatPercent, relativeTime } from "@/lib/format";

export function Overview() {
  const { activeProjectId, activeProject } = useActiveProject();
  const pid = activeProjectId ?? undefined;
  const overview = useAsync(() => apiClient.getOverview(pid), [pid]);
  const analytics = useAsync(() => apiClient.getAnalytics(pid), [pid]);
  const findings = useAsync(() => apiClient.listFindings({ projectId: pid }), [pid]);
  const campaigns = useAsync(() => apiClient.listCampaigns({ projectId: pid }), [pid]);
  const settings = useAsync(() => apiClient.getSettings(), []);

  function refreshAll() {
    overview.refetch();
    analytics.refetch();
    findings.refetch();
    campaigns.refetch();
  }

  const statSkeleton = (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={
          activeProject
            ? `What is happening with ModelWrecker in ${activeProject.name}.`
            : "What is happening with ModelWrecker across all your projects."
        }
        actions={
          <>
            <Button variant="outline" size="icon" onClick={refreshAll} aria-label="Refresh">
              <RefreshCw />
            </Button>
            <Link to="/campaigns?new=1" className={buttonClasses("default", "default")}>
              <Swords />
              New campaign
            </Link>
          </>
        }
      />

      {/* Headline stats */}
      <DataState
        loading={overview.loading}
        error={overview.error}
        data={overview.data}
        onRetry={overview.refetch}
        errorTitle="Unable to load overview metrics."
        skeleton={statSkeleton}
      >
        {(o) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total campaigns" value={formatNumber(o.totalCampaigns)} icon={Swords} delta={o.deltas.totalCampaigns} />
            <StatCard
              label="Attack success rate"
              value={formatPercent(o.attackSuccessRate)}
              icon={Activity}
              delta={o.deltas.attackSuccessRate}
              invertDelta
            />
            <StatCard label="Total findings" value={formatNumber(o.totalFindings)} icon={ShieldAlert} delta={o.deltas.totalFindings} invertDelta />
            <StatCard
              label="Critical findings"
              value={formatNumber(o.criticalFindings)}
              icon={AlertOctagon}
              delta={o.deltas.criticalFindings}
              invertDelta
            />
          </div>
        )}
      </DataState>

      {/* Charts + engine status, like the reference's three-card row */}
      <div className="grid gap-4 lg:grid-cols-3">
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
              {(a) => <CampaignActivityChart data={a.campaignActivity} height={220} />}
            </DataState>
          </CardContent>
        </Card>

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
              {(a) => <TrendLineChart data={a.successRateOverTime} asPercent height={220} valueLabel="Success rate" />}
            </DataState>
          </CardContent>
        </Card>

        <EngineStatusCard projectId={pid} />
      </div>

      {/* Secondary stats */}
      <DataState
        loading={overview.loading}
        error={overview.error}
        data={overview.data}
        onRetry={overview.refetch}
        errorTitle="Unable to load overview metrics."
        skeleton={statSkeleton}
      >
        {(o) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active targets" value={formatNumber(o.activeTargets)} icon={Crosshair} hint="Authorized and in use" />
            <StatCard label="Connected devices" value={formatNumber(o.connectedDevices)} icon={MonitorSmartphone} hint="Local engines online" />
            <StatCard label="Runs this period" value={formatNumber(o.runsThisPeriod)} icon={Repeat} delta={o.deltas.runsThisPeriod} />
            <StatCard label="Successful attacks" value={formatNumber(o.successfulAttacks)} icon={Zap} hint="Before reliability replay" />
          </div>
        )}
      </DataState>

      {/* Recent findings + severity */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Recent findings</CardTitle>
              <CardDescription>Latest verified weaknesses.</CardDescription>
            </div>
            <Link to="/findings" className={buttonClasses("outline", "sm")}>
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <DataState
              loading={findings.loading}
              error={findings.error}
              data={findings.data}
              onRetry={findings.refetch}
              errorTitle="Unable to load findings."
              skeleton={<SkeletonRows rows={5} cols={4} />}
              empty={
                <EmptyState
                  icon={ShieldAlert}
                  title="No findings yet"
                  description="Findings appear after a campaign verifies an attack by replaying it."
                />
              }
            >
              {(list) => (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Finding</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Found</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.slice(0, 5).map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="max-w-[22rem]">
                              <Link to={`/findings/${f.id}`} className="block hover:underline">
                                <span className="line-clamp-1 font-medium">{f.title}</span>
                              </Link>
                              <span className="text-xs text-muted-foreground">{f.targetName}</span>
                            </TableCell>
                            <TableCell>
                              <SeverityBadge severity={f.severity} />
                            </TableCell>
                            <TableCell>
                              <FindingStatusBadge status={f.status} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                              {relativeTime(f.discoveredAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ul className="divide-y rounded-md border md:hidden">
                    {list.slice(0, 5).map((f) => (
                      <li key={f.id}>
                        <Link to={`/findings/${f.id}`} className="flex items-center gap-3 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{f.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {f.targetName} - {relativeTime(f.discoveredAt)}
                            </p>
                          </div>
                          <SeverityBadge severity={f.severity} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </DataState>
          </CardContent>
        </Card>

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
              {(a) => <SeverityDonut breakdown={a.severityBreakdown} />}
            </DataState>
          </CardContent>
        </Card>
      </div>

      {/* Recent campaigns + data boundary */}
      <div className="grid gap-4 xl:grid-cols-3">
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
                  {list.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link to={`/campaigns/${c.id}`} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.targetName} - {c.findingCount} findings - {formatNumber(c.attemptCount)} attempts
                          </p>
                        </div>
                        <CampaignStatusBadge status={c.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Where your data lives</CardTitle>
            <CardDescription>The dashboard is the control plane. Attacks run on your machine.</CardDescription>
          </CardHeader>
          <CardContent>
            <CloudLocalDiagram
              className="md:grid-cols-1"
              evidenceSynced={!!settings.data && (settings.data.sync.detailedEvidence || settings.data.sync.transcripts)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
