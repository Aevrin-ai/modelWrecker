import { Link } from "react-router-dom";
import { Activity, BarChart3, Crosshair, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { DataState, EmptyState, SkeletonCards } from "@/components/States";
import { CampaignRunsChart, SeverityDonut, StrategyBars, TrendLineChart } from "@/components/charts";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { formatNumber, formatPercent } from "@/lib/format";

/** Below this many attempts the 95% range is too wide to compare targets; the page says so. */
const SMALL_SAMPLE = 30;

export function Analytics() {
  const { activeProjectId } = useActiveProject();
  const a = useAsync(() => apiClient.getAnalytics(activeProjectId ?? undefined), [activeProjectId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Built from synced run metadata. Attack success rate is measured per attempt with Wilson 95% confidence intervals."
      />
      <DataState
        loading={a.loading}
        error={a.error}
        data={a.data}
        onRetry={a.refetch}
        errorTitle="Unable to load analytics."
        skeleton={<SkeletonCards count={4} className="sm:grid-cols-2 lg:grid-cols-4" />}
        isEmpty={(d) => d.totalAttempts === 0}
        empty={
          <EmptyState
            icon={BarChart3}
            title="No runs to analyze yet"
            description="Analytics appear after your local engine syncs its first campaign results."
          />
        }
      >
        {(d) => (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Attack success rate"
                icon={Crosshair}
                value={formatPercent(d.asr, 1)}
                hint={`95% CI ${formatPercent(d.asrCiLow, 0)} - ${formatPercent(d.asrCiHigh, 0)}`}
              />
              <StatCard icon={ShieldCheck} label="Robustness" value={formatPercent(d.robustness, 1)} hint="Share of attempts the target resisted" />
              <StatCard icon={Activity} label="Attack attempts" value={formatNumber(d.totalAttempts)} hint="Across all synced runs" />
              <StatCard icon={ShieldAlert} label="Findings" value={formatNumber(d.totalFindings)} hint="Verified by replay" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Attack success rate over time</CardTitle>
                  <CardDescription>Lower is better for the target.</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendLineChart data={d.successRateOverTime} asPercent valueLabel="ASR" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Findings by severity</CardTitle>
                  <CardDescription>All verified findings in scope.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SeverityDonut breakdown={d.severityBreakdown} />
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
                  <TrendLineChart data={d.findingsOverTime} valueLabel="Findings" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Campaign activity</CardTitle>
                  <CardDescription>Campaigns and runs per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <CampaignRunsChart data={d.campaignActivity} />
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
                  <StrategyBars data={d.byStrategy} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Taxonomy coverage</CardTitle>
                  <CardDescription>Findings mapped to OWASP and MITRE ATLAS.</CardDescription>
                </CardHeader>
                <CardContent>
                  {d.byTaxonomy.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No mapped findings yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {d.byTaxonomy.map((t) => (
                        <li key={`${t.framework}-${t.id}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0">
                            <span className="font-mono text-xs">{t.id}</span>{" "}
                            <span className="text-muted-foreground">{t.title}</span>
                          </span>
                          <span className="font-medium tabular-nums">{t.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Target leaderboard</CardTitle>
                <CardDescription>
                  Most robust first. Attack success rate (ASR) is the share of attacks that worked; lower means a
                  harder target. Open a target to read every prompt and reply.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="text-right">ASR</TableHead>
                      <TableHead className="text-right">95% range</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead className="text-right">Refused</TableHead>
                      <TableHead className="text-right">Findings</TableHead>
                      <TableHead className="text-right">High + critical</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...d.leaderboard]
                      .sort((x, y) => x.asr - y.asr)
                      .map((r, i) => (
                        <TableRow key={r.targetId}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {r.latestCampaignId ? (
                              <Link to={`/campaigns/${r.latestCampaignId}`} className="hover:underline">
                                {r.targetName}
                              </Link>
                            ) : (
                              r.targetName
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(r.asr, 1)}
                            <span className="block text-xs text-muted-foreground">
                              {formatNumber(r.successes)} of {formatNumber(r.attempts)} worked
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                            {formatPercent(r.ciLow, 0)} - {formatPercent(r.ciHigh, 0)}
                            {r.attempts < SMALL_SAMPLE && (
                              <span className="block text-amber-700 dark:text-amber-300">small sample</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.attempts)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(r.refusals)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.findings}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.highCritical}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {d.leaderboard.some((r) => r.attempts < SMALL_SAMPLE) && (
                  <p className="max-w-prose text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Small sample:</span> fewer than {SMALL_SAMPLE} attempts.
                    The 95% range is wide because there is little evidence yet. For example, 0 of 4 means the target
                    refused every attack that was tried, not that it is safe: the true rate could still be up to the top
                    of the range. Run more objectives and strategies against it for a reliable number.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DataState>
    </div>
  );
}
