import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Search, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ConfidenceBadge,
  FindingStatusBadge,
  SeverityBadge,
  TargetTypeBadge,
} from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { humanize, relativeTime, formatPercent } from "@/lib/format";
import { SEVERITY_ORDER } from "@/lib/constants";
import type { Finding, FindingStatus, Severity } from "@/types";

const STATUSES: FindingStatus[] = ["open", "triaged", "fixed", "accepted-risk"];

export function Findings() {
  const { activeProjectId } = useActiveProject();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<FindingStatus | "all">("all");

  const { data, loading, error, refetch } = useAsync(
    () => apiClient.listFindings({ projectId: activeProjectId ?? undefined }),
    [activeProjectId],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter(
      (f) =>
        (severity === "all" || f.severity === severity) &&
        (status === "all" || f.status === status) &&
        (!q ||
          f.title.toLowerCase().includes(q) ||
          f.targetName.toLowerCase().includes(q) ||
          f.strategy.toLowerCase().includes(q)),
    );
  }, [data, query, severity, status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings"
        description="Verified weaknesses. Each has a measured success rate, not a one-shot result."
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, target, or strategy"
              className="pl-9"
            />
          </div>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "all")}>
            <option value="all">All severities</option>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s} className="capitalize">
                {humanize(s)}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value as FindingStatus | "all")}>
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={refetch}
        skeleton={<SkeletonRows rows={6} cols={6} />}
        empty={
          <EmptyState
            icon={ShieldAlert}
            title="No findings yet"
            description="Findings appear here after a campaign verifies an attack on a target."
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No findings match your filters"
              description="Try clearing the search or changing the severity and status filters."
            />
          ) : (
            <>
              {/* Desktop table */}
              <Card className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Reliability</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Found</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((f) => (
                      <FindingRow key={f.id} f={f} />
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map((f) => (
                  <Link key={f.id} to={`/findings/${f.id}`}>
                    <Card className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{f.title}</p>
                        <SeverityBadge severity={f.severity} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {f.targetName} - {humanize(f.strategy)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <FindingStatusBadge status={f.status} />
                        <ConfidenceBadge level={f.reliability.confidence} />
                        {!f.evidence.synced && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock className="size-3" /> Evidence local
                          </span>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )
        }
      </DataState>
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  return (
    <TableRow className="cursor-pointer">
      <TableCell className="max-w-xs">
        <Link to={`/findings/${f.id}`} className="block">
          <span className="line-clamp-1 font-medium">{f.title}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {f.evidence.synced ? "Evidence synced" : (
              <>
                <Lock className="size-3" /> Evidence stays local
              </>
            )}
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <SeverityBadge severity={f.severity} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <TargetTypeBadge type={f.targetType} />
          <span className="truncate text-sm">{f.targetName}</span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{f.strategy}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <ConfidenceBadge level={f.reliability.confidence} />
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatPercent(f.reliability.successRate, 0)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <FindingStatusBadge status={f.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {relativeTime(f.discoveredAt)}
      </TableCell>
    </TableRow>
  );
}
