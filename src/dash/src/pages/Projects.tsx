import { useState } from "react";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { DataState, EmptyState } from "@/components/States";
import { ProjectDialog } from "@/components/dialogs";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { ArchivedProjects } from "./projects/ArchivedProjects";
import { ProjectCard } from "./projects/ProjectCard";
import { ProjectCardsSkeleton } from "./projects/ProjectCardsSkeleton";

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
        skeleton={<ProjectCardsSkeleton />}
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
          const active = projects.filter((project) => !project.archived);
          const archived = projects.filter((project) => project.archived);
          return (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>

              {archived.length > 0 && <ArchivedProjects archived={archived} />}
            </div>
          );
        }}
      </DataState>

      <ProjectDialog open={creating} onClose={() => setCreating(false)} onSaved={() => refetch()} />
    </div>
  );
}
