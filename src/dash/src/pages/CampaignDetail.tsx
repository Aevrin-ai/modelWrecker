import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Pencil, Play, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampaignStatusBadge, ConfidenceBadge, SeverityBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, ErrorState, SkeletonCards } from "@/components/States";
import { ConfirmDialog, RenameDialog } from "@/components/dialogs";
import { ControlPlaneCallout, EvidenceLocalNotice } from "@/components/LocalBoundary";
import { SeverityBar } from "@/components/charts";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { STOP_CONDITION_LABEL, SEVERITY_ORDER } from "@/lib/constants";
import { formatDateTime, formatDuration, formatNumber, formatPercent, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Campaign, Severity } from "@/types";

export function CampaignDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const campaign = useAsync(() => apiClient.getCampaign(id), [id]);
  const timeline = useAsync(() => apiClient.getCampaignTimeline(id), [id]);
  const stats = useAsync(() => apiClient.getCampaignStats(id), [id]);
  const findings = useAsync(() => apiClient.listFindings({ campaignId: id }), [id]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const back = (
    <Link to="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Campaigns
    </Link>
  );

  if (campaign.loading && !campaign.data) return <SkeletonCards count={4} className="sm:grid-cols-2" />;
  if (campaign.error) return <ErrorState title="Unable to load this campaign." onRetry={campaign.refetch} />;
  if (!campaign.data)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="Campaign not found" description="It may have been deleted, or it belongs to another project." />
      </div>
    );

  const c = campaign.data;
  const canMarkReady = c.status === "draft";
  const canUnmark = c.status === "ready";

  async function toggleReady(c: Campaign) {
    setBusy(true);
    try {
      if (c.status === "draft") {
        await apiClient.markCampaignReady(c.id);
        toast({ title: "Marked ready", description: "Your local engine will pick it up on its next sync." });
      } else {
        await apiClient.unmarkCampaignReady(c.id);
        toast({ title: "Moved back to draft" });
      }
      campaign.refetch();
      timeline.refetch();
    } catch {
      toast({ title: "Could not update the campaign", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const severity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  (findings.data ?? []).forEach((f) => (severity[f.severity] += 1));

  const facts: [string, string][] = [
    ["Target", c.targetName],
    ["Device", c.deviceName ?? "Not picked up yet"],
    ["Project", c.projectName],
    ["Started", formatDateTime(c.startedAt)],
    ["Completed", formatDateTime(c.completedAt)],
    ["Duration", formatDuration(c.durationSeconds)],
    ["Stop condition", STOP_CONDITION_LABEL[c.stopCondition]],
    ["Concurrency", String(c.concurrency)],
    ["Objectives", String(c.objectiveCount)],
    ["Max attempts", c.budget.maxAttempts == null ? "No limit" : formatNumber(c.budget.maxAttempts)],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={back}
        title={c.name}
        description={`${c.strategies.length} strategies against ${c.targetName}`}
        actions={
          <>
            <CampaignStatusBadge status={c.status} />
            {canMarkReady && (
              <Button onClick={() => toggleReady(c)} disabled={busy}>
                <Play /> Mark ready for engine
              </Button>
            )}
            {canUnmark && (
              <Button variant="outline" onClick={() => toggleReady(c)} disabled={busy}>
                <Undo2 /> Back to draft
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => setRenaming(true)} aria-label="Rename campaign">
              <Pencil />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setDeleting(true)} aria-label="Delete campaign">
              <Trash2 />
            </Button>
          </>
        }
      />

      {(canMarkReady || canUnmark) && (
        <ControlPlaneCallout title="The cloud does not run this campaign">
          Marking a campaign ready only flags it. Your local ModelWrecker engine picks it up, runs every attack on your
          machine, and syncs summarized results back here.
        </ControlPlaneCallout>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Attack attempts", formatNumber(c.attemptCount)],
          ["Successful attacks", formatNumber(c.successfulAttacks)],
          ["Findings", String(c.findingCount)],
          ["Success rate", formatPercent(c.successRate, 1)],
        ].map(([label, value]) => (
          <Card key={label} className="p-6">
            <p className="text-sm font-medium tracking-tight">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Attack statistics</CardTitle>
            <CardDescription>Attempts and successes per strategy, synced from the local run.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={stats.loading}
              error={stats.error}
              data={stats.data}
              onRetry={stats.refetch}
              isEmpty={(d) => d.byStrategy.length === 0}
              empty={<EmptyState title="No attempts yet" description="Statistics appear after the engine starts this campaign." />}
            >
              {(s) => (
                <div className="space-y-4">
                  {s.byStrategy.map((row) => {
                    const rate = row.attempts ? row.successes / row.attempts : 0;
                    return (
                      <div key={row.strategy}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{row.strategy}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {row.successes} / {row.attempts} ({formatPercent(rate, 0)})
                          </span>
                        </div>
                        <Progress value={rate} className="mt-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </DataState>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Read by the local engine when it picks the campaign up.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {c.strategies.map((s) => (
                <span key={s} className="rounded-md border px-2 py-1 font-mono text-xs">
                  {s}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Campaign timeline</CardTitle>
            <CardDescription>Status and progress events from the engine.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataState
              loading={timeline.loading}
              error={timeline.error}
              data={timeline.data}
              onRetry={timeline.refetch}
              empty={<EmptyState icon={Clock} title="No events yet" />}
            >
              {(events) => (
                <ol className="relative space-y-5 border-l pl-5">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[25px] top-1 size-2.5 rounded-full border-2 border-background",
                          e.kind === "finding" ? "bg-severity-critical" : e.kind === "status" ? "bg-primary" : "bg-muted-foreground",
                        )}
                      />
                      <p className="text-sm font-medium">{e.label}</p>
                      <p className="text-xs text-muted-foreground">{e.detail}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{relativeTime(e.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </DataState>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Findings</CardTitle>
            <CardDescription>Verified by replay before they appear here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SeverityBar breakdown={severity} />
            <DataState
              loading={findings.loading}
              error={findings.error}
              data={findings.data}
              onRetry={findings.refetch}
              empty={<EmptyState icon={ShieldAlert} title="No findings in this campaign" description="Nothing reproduced reliably enough to become a finding." />}
            >
              {(rows) => (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Finding</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Reliability</TableHead>
                        <TableHead>Found</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...rows]
                        .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
                        .map((f) => (
                          <TableRow key={f.id}>
                            <TableCell>
                              <Link to={`/findings/${f.id}`} className="font-medium hover:underline">
                                {f.title}
                              </Link>
                              <span className="block font-mono text-xs text-muted-foreground">{f.strategy}</span>
                            </TableCell>
                            <TableCell>
                              <SeverityBadge severity={f.severity} />
                            </TableCell>
                            <TableCell>
                              <ConfidenceBadge level={f.reliability.confidence} />
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{relativeTime(f.discoveredAt)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DataState>
            <EvidenceLocalNotice />
          </CardContent>
        </Card>
      </div>

      <RenameDialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename campaign"
        initial={c.name}
        onSave={async (name) => {
          await apiClient.renameCampaign(c.id, name);
          campaign.refetch();
        }}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this campaign?"
        description="This removes the campaign and its synced metadata from the dashboard. Local results on your device are not touched."
        confirmLabel="Delete campaign"
        destructive
        onConfirm={async () => {
          await apiClient.deleteCampaign(c.id);
          navigate("/campaigns");
        }}
      />
    </div>
  );
}
