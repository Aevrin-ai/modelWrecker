import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CampaignStatusBadge,
  DeviceStatusBadge,
  FindingStatusBadge,
  SeverityBadge,
  TargetStatusBadge,
  TargetTypeBadge,
} from "@/components/StatusBadges";
import { DataState, EmptyState, ErrorState, SkeletonCards, SkeletonRows } from "@/components/States";
import { ConfirmDialog, ProjectDialog } from "@/components/dialogs";
import { SeverityDonut } from "@/components/charts";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import { formatDate, formatPercent, relativeTime } from "@/lib/format";

export function ProjectDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshProjects } = useActiveProject();
  const project = useAsync(() => apiClient.getProject(id), [id]);
  const targets = useAsync(() => apiClient.listTargets({ projectId: id }), [id]);
  const campaigns = useAsync(() => apiClient.listCampaigns({ projectId: id }), [id]);
  const findings = useAsync(() => apiClient.listFindings({ projectId: id }), [id]);
  const devices = useAsync(() => apiClient.listDevices({ projectId: id }), [id]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const back = (
    <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Projects
    </Link>
  );

  if (project.loading && !project.data) return <SkeletonCards count={4} className="sm:grid-cols-2" />;
  if (project.error) return <ErrorState title="Unable to load this project." onRetry={project.refetch} />;
  if (!project.data)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState title="Project not found" description="It may have been deleted, or you do not have access to it." />
      </div>
    );

  const p = project.data;

  async function toggleArchive() {
    try {
      await apiClient.updateProject(p.id, { archived: !p.archived });
      toast({ title: p.archived ? "Project restored" : "Project archived" });
      project.refetch();
      refreshProjects();
    } catch {
      toast({ title: "Could not update the project", tone: "error" });
    }
  }

  const counts: [string, number][] = [
    ["Targets", p.counts.targets],
    ["Campaigns", p.counts.campaigns],
    ["Findings", p.counts.findings],
    ["Connected devices", p.counts.devices],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={back}
        title={p.name}
        description={p.description || "No description"}
        actions={
          <>
            {p.archived && <Badge>Archived</Badge>}
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={toggleArchive}>
              {p.archived ? <ArchiveRestore /> : <Archive />} {p.archived ? "Restore" : "Archive"}
            </Button>
            <Button variant="outline" size="icon" aria-label="Delete project" onClick={() => setDeleting(true)}>
              <Trash2 />
            </Button>
          </>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="no-scrollbar max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {counts.map(([label, n]) => (
              <Card key={label} className="p-6">
                <p className="text-sm font-medium tracking-tight">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{n}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Risk summary</CardTitle>
                <CardDescription>Open findings by severity.</CardDescription>
              </CardHeader>
              <CardContent>
                <SeverityDonut breakdown={p.riskSummary} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="font-medium">{formatDate(p.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last activity</dt>
                    <dd className="font-medium">{p.lastActivityAt ? relativeTime(p.lastActivityAt) : "No activity yet"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Description</dt>
                    <dd className="font-medium">{p.description || "No description"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="targets">
          <DataState loading={targets.loading} error={targets.error} data={targets.data} onRetry={targets.refetch} skeleton={<SkeletonRows rows={4} cols={5} />} empty={<EmptyState title="No targets in this project" />}>
            {(rows) => (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Target</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last tested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <TargetTypeBadge type={t.type} />
                        </TableCell>
                        <TableCell>{t.provider}</TableCell>
                        <TableCell>
                          <TargetStatusBadge status={t.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.lastTestedAt ? relativeTime(t.lastTestedAt) : "Never"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </DataState>
        </TabsContent>

        <TabsContent value="campaigns">
          <DataState loading={campaigns.loading} error={campaigns.error} data={campaigns.data} onRetry={campaigns.refetch} skeleton={<SkeletonRows rows={4} cols={5} />} empty={<EmptyState title="No campaigns in this project" />}>
            {(rows) => (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="text-right">Findings</TableHead>
                      <TableHead className="text-right">ASR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link to={`/campaigns/${c.id}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <CampaignStatusBadge status={c.status} />
                        </TableCell>
                        <TableCell>{c.targetName}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.findingCount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPercent(c.successRate, 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </DataState>
        </TabsContent>

        <TabsContent value="findings">
          <DataState loading={findings.loading} error={findings.error} data={findings.data} onRetry={findings.refetch} skeleton={<SkeletonRows rows={4} cols={4} />} empty={<EmptyState title="No findings in this project" />}>
            {(rows) => (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Finding</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Found</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Link to={`/findings/${f.id}`} className="font-medium hover:underline">
                            {f.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={f.severity} />
                        </TableCell>
                        <TableCell>
                          <FindingStatusBadge status={f.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{relativeTime(f.discoveredAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </DataState>
        </TabsContent>

        <TabsContent value="devices">
          <DataState loading={devices.loading} error={devices.error} data={devices.data} onRetry={devices.refetch} skeleton={<SkeletonRows rows={3} cols={4} />} empty={<EmptyState title="No devices linked to this project" />}>
            {(rows) => (
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>
                          <DeviceStatusBadge status={d.status} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">v{d.engineVersion}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{relativeTime(d.lastSeenAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </DataState>
        </TabsContent>
      </Tabs>

      <ProjectDialog
        open={editing}
        onClose={() => setEditing(false)}
        project={p}
        onSaved={() => project.refetch()}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this project?"
        description="This removes the project and its synced metadata from the dashboard. Local engine results are not touched."
        confirmLabel="Delete project"
        destructive
        onConfirm={async () => {
          await apiClient.deleteProject(p.id);
          refreshProjects();
          navigate("/projects");
        }}
      />
    </div>
  );
}
