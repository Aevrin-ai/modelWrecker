import { Link } from "react-router-dom";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/types";

export interface ArchivedProjectsProps {
  archived: Project[];
}

export function ArchivedProjects({ archived }: ArchivedProjectsProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Archived</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {archived.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`}>
            <Card className="h-full opacity-75 transition-opacity hover:opacity-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="truncate font-semibold">{project.name}</p>
                  <Badge tone="bg-secondary text-secondary-foreground">Archived</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
