import { Link } from "react-router-dom";
import { Crosshair, FolderKanban, MonitorSmartphone, ShieldAlert, Swords } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SeverityBar } from "@/components/charts";
import { relativeTime } from "@/lib/format";
import { SEVERITY_ORDER } from "@/lib/constants";
import { SEVERITY_DOT } from "@/lib/badges";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";
import { CountCell } from "./CountCell";

export interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const totalRisk = SEVERITY_ORDER.reduce((sum, severity) => sum + project.riskSummary[severity], 0);
  return (
    <Link to={`/projects/${project.id}`}>
      <Card className="h-full transition-shadow hover:shadow-card-hover">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <FolderKanban className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{project.name}</p>
              <p className="text-xs text-muted-foreground">
                Active {relativeTime(project.lastActivityAt)}
              </p>
            </div>
          </div>
          <p className="line-clamp-2 pt-1 text-sm text-muted-foreground">
            {project.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Risk profile</span>
              <span className="font-medium">{totalRisk} findings</span>
            </div>
            <SeverityBar breakdown={project.riskSummary} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
              {SEVERITY_ORDER.filter((severity) => project.riskSummary[severity] > 0).map((severity) => (
                <span key={severity} className="flex items-center gap-1 text-xs">
                  <span className={cn("size-1.5 rounded-full", SEVERITY_DOT[severity])} />
                  <span className="capitalize text-muted-foreground">{severity}</span>
                  <span className="font-medium tabular-nums">{project.riskSummary[severity]}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 border-t pt-3 text-center">
            <CountCell icon={Crosshair} value={project.counts.targets} label="Targets" />
            <CountCell icon={Swords} value={project.counts.campaigns} label="Campaigns" />
            <CountCell icon={ShieldAlert} value={project.counts.findings} label="Findings" />
            <CountCell icon={MonitorSmartphone} value={project.counts.devices} label="Devices" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
