import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SeverityDonut } from "@/components/charts";
import { formatDate, relativeTime } from "@/lib/format";
import type { Project } from "@/types";

export interface ProjectOverviewTabProps {
  project: Project;
}

export function ProjectOverviewTab({ project }: ProjectOverviewTabProps) {
  const counts: [string, number][] = [
    ["Targets", project.counts.targets],
    ["Campaigns", project.counts.campaigns],
    ["Findings", project.counts.findings],
    ["Connected devices", project.counts.devices],
  ];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map(([label, count]) => (
          <Card key={label} className="p-6">
            <p className="text-sm font-medium tracking-tight">{label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{count}</p>
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
            <SeverityDonut breakdown={project.riskSummary} />
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
                <dd className="font-medium">{formatDate(project.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last activity</dt>
                <dd className="font-medium">{project.lastActivityAt ? relativeTime(project.lastActivityAt) : "No activity yet"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Description</dt>
                <dd className="font-medium">{project.description || "No description"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
