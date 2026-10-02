import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Swords } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampaignStatusBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { CampaignDialog } from "@/components/dialogs";
import { RunsLocallyChip } from "@/components/LocalBoundary";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/constants";
import { formatNumber, formatPercent, relativeTime } from "@/lib/format";
import type { Campaign, CampaignStatus } from "@/types";

const STATUSES = Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[];

export function Campaigns() {
  const { activeProjectId } = useActiveProject();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [creating, setCreating] = useState(false);

  const campaigns = useAsync(() => apiClient.listCampaigns({ projectId: activeProjectId ?? undefined }), [activeProjectId]);
  const targets = useAsync(() => apiClient.listTargets({ projectId: activeProjectId ?? undefined }), [activeProjectId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (campaigns.data ?? []).filter(
      (c) =>
        (status === "all" || c.status === status) &&
        (!q || c.name.toLowerCase().includes(q) || c.targetName.toLowerCase().includes(q)),
    );
  }, [campaigns.data, query, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Configure campaigns here. Your local ModelWrecker engine runs them and syncs the results back."
        actions={
          <>
            <RunsLocallyChip />
            <Button onClick={() => setCreating(true)}>
              <Plus /> New campaign
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns or targets" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus | "all")}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <DataState
        loading={campaigns.loading}
        error={campaigns.error}
        data={campaigns.data}
        onRetry={campaigns.refetch}
        errorTitle="Unable to load campaigns."
        skeleton={<SkeletonRows rows={6} cols={6} />}
        empty={
          <EmptyState
            icon={Swords}
            title="No campaigns yet"
            description="Create a campaign, mark it ready, and your connected local engine will pick it up."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus /> New campaign
              </Button>
            }
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState icon={Search} title="No campaigns match your filters" description="Clear the search or pick another status." />
          ) : (
            <>
              <Card className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Strategies</TableHead>
                      <TableHead className="text-right">Attempts</TableHead>
                      <TableHead className="text-right">Findings</TableHead>
                      <TableHead className="text-right">ASR</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <CampaignRow key={c.id} c={c} />
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <div className="space-y-3 md:hidden">
                {filtered.map((c) => (
                  <Link key={c.id} to={`/campaigns/${c.id}`}>
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{c.name}</p>
                        <CampaignStatusBadge status={c.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.targetName} - {c.strategies.length} strategies
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <span>
                          <span className="block text-muted-foreground">Attempts</span>
                          {formatNumber(c.attemptCount)}
                        </span>
                        <span>
                          <span className="block text-muted-foreground">Findings</span>
                          {c.findingCount}
                        </span>
                        <span>
                          <span className="block text-muted-foreground">ASR</span>
                          {formatPercent(c.successRate, 0)}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )
        }
      </DataState>

      <CampaignDialog
        open={creating}
        onClose={() => setCreating(false)}
        targets={targets.data ?? []}
        onSaved={() => campaigns.refetch()}
      />
    </div>
  );
}

function CampaignRow({ c }: { c: Campaign }) {
  return (
    <TableRow>
      <TableCell className="max-w-xs">
        <Link to={`/campaigns/${c.id}`} className="block">
          <span className="line-clamp-1 font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">{c.projectName}</span>
        </Link>
      </TableCell>
      <TableCell>
        <CampaignStatusBadge status={c.status} />
      </TableCell>
      <TableCell className="text-sm">{c.targetName}</TableCell>
      <TableCell>
        <span className="line-clamp-1 font-mono text-xs">{c.strategies.join(", ")}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(c.attemptCount)}</TableCell>
      <TableCell className="text-right tabular-nums">{c.findingCount}</TableCell>
      <TableCell className="text-right tabular-nums">{formatPercent(c.successRate, 0)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {relativeTime(c.completedAt ?? c.startedAt ?? c.createdAt)}
      </TableCell>
    </TableRow>
  );
}
