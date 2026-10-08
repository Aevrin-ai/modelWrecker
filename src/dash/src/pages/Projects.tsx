import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Crosshair, Swords, ShieldAlert, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBar } from "@/components/charts";
import { DataState, EmptyState } from "@/components/States";
import { ProjectDialog } from "@/components/dialogs";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { relativeTime } from "@/lib/format";
import { SEVERITY_ORDER } from "@/lib/constants";
import { SEVERITY_DOT } from "@/lib/badges";
import { cn } from "@/lib/utils";

export function Projects() {
  const { data, loading, error, refetch } = useAsync(() => apiClient.listProjects(), []);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Each project groups the targets, campaigns, and findings for one system under test."
        actions={
          <Button variant="brand" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        data={data}
        onRetry={refetch}
        skeleton={
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-6 h-2 w-full" />
                <Skeleton className="mt-4 h-8 w-full" />
              </Card>
            ))}
          </div>
        }
        empty={
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create your first project to start organizing targets and campaigns."
            action={
              <Button variant="brand" size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                New project
              </Button>
            }
          />
        }
      >
        {(projects) => {
          const active = projects.filter((p) => !p.archived);
          const archived = projects.filter((p) => p.archived);
          return (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((p) => {
                  const totalRisk = SEVERITY_ORDER.reduce((a, s) => a + p.riskSummary[s], 0);
                  return (
                    <Link key={p.id} to={`/projects/${p.id}`}>
                      <Card className="h-full transition-shadow hover:shadow-card-hover">
                        <CardHeader>
                          <div className="flex items-start gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                              <FolderKanban className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Active {relativeTime(p.lastActivityAt)}
                              </p>
                            </div>
                          </div>
                          <p className="line-clamp-2 pt-1 text-sm text-muted-foreground">
                            {p.description}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Risk profile</span>
                              <span className="font-medium">{totalRisk} findings</span>
                            </div>
                            <SeverityBar breakdown={p.riskSummary} />
                            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                              {SEVERITY_ORDER.filter((s) => p.riskSummary[s] > 0).map((s) => (
                                <span key={s} className="flex items-center gap-1 text-xs">
                                  <span className={cn("size-1.5 rounded-full", SEVERITY_DOT[s])} />
                                  <span className="capitalize text-muted-foreground">{s}</span>
                                  <span className="font-medium tabular-nums">{p.riskSummary[s]}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 border-t pt-3 text-center">
                            <CountCell icon={Crosshair} value={p.counts.targets} label="Targets" />
                            <CountCell icon={Swords} value={p.counts.campaigns} label="Campaigns" />
                            <CountCell icon={ShieldAlert} value={p.counts.findings} label="Findings" />
                            <CountCell icon={MonitorSmartphone} value={p.counts.devices} label="Devices" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {archived.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-muted-foreground">Archived</h2>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {archived.map((p) => (
                      <Link key={p.id} to={`/projects/${p.id}`}>
                        <Card className="h-full opacity-75 transition-opacity hover:opacity-100">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <p className="truncate font-semibold">{p.name}</p>
                              <Badge tone="bg-secondary text-secondary-foreground">Archived</Badge>
                            </div>
                            <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                          </CardHeader>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }}
      </DataState>

      <ProjectDialog open={creating} onClose={() => setCreating(false)} onSaved={() => refetch()} />
    </div>
  );
}

function CountCell({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Crosshair;
  value: number;
  label: string;
}) {
  return (
    <div className="space-y-0.5">
      <Icon className="mx-auto size-4 text-muted-foreground" />
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}
