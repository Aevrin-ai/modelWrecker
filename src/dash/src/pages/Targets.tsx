import { useMemo, useState } from "react";
import { Crosshair, Plus, Search, ShieldCheck, ShieldX } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SeverityBadge, TargetStatusBadge, TargetTypeBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { relativeTime } from "@/lib/format";
import { TARGET_TYPE_LABEL } from "@/lib/constants";
import type { TargetType } from "@/types";

const TYPES: TargetType[] = ["chat", "agent", "rag", "mcp"];

export function Targets() {
  const { activeProjectId } = useActiveProject();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TargetType | "all">("all");

  const { data, loading, error, refetch } = useAsync(
    () => apiClient.listTargets({ projectId: activeProjectId ?? undefined }),
    [activeProjectId],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          t.provider.toLowerCase().includes(q) ||
          t.model.toLowerCase().includes(q)),
    );
  }, [data, query, type]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Targets"
        description="The AI systems under test. A target must be authorized before any campaign can run against it."
        actions={
          <Button variant="brand" size="sm">
            <Plus className="size-4" />
            Add target
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, provider, or model"
              className="pl-9"
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value as TargetType | "all")}>
            <option value="all">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TARGET_TYPE_LABEL[t]}
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
            icon={Crosshair}
            title="No targets yet"
            description="Add a chat, agent, RAG, or MCP target to start red-teaming it."
            action={
              <Button variant="brand" size="sm">
                <Plus className="size-4" />
                Add target
              </Button>
            }
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState icon={Search} title="No targets match your filters" />
          ) : (
            <>
              <Card className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Authorized</TableHead>
                      <TableHead>Campaigns</TableHead>
                      <TableHead>Top severity</TableHead>
                      <TableHead>Last tested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <p className="font-medium">{t.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{t.endpoint}</p>
                        </TableCell>
                        <TableCell>
                          <TargetTypeBadge type={t.type} />
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{t.model}</p>
                          <p className="text-xs text-muted-foreground">{t.provider}</p>
                        </TableCell>
                        <TableCell>
                          <TargetStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell>
                          {t.authorized ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="size-3.5" /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <ShieldX className="size-3.5" /> No
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">{t.campaignCount}</TableCell>
                        <TableCell>
                          {t.topSeverity ? <SeverityBadge severity={t.topSeverity} /> : <span className="text-xs text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {relativeTime(t.lastTestedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <div className="space-y-3 md:hidden">
                {filtered.map((t) => (
                  <Card key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{t.model}</p>
                      </div>
                      <TargetTypeBadge type={t.type} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <TargetStatusBadge status={t.status} />
                      {t.authorized ? (
                        <Badge tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Authorized
                        </Badge>
                      ) : (
                        <Badge tone="bg-secondary text-secondary-foreground">Not authorized</Badge>
                      )}
                      {t.topSeverity && <SeverityBadge severity={t.topSeverity} />}
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )
        }
      </DataState>
    </div>
  );
}
