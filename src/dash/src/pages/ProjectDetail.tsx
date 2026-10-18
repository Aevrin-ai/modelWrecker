import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, SkeletonCards } from "@/components/States";
import { ConfirmDialog, ProjectDialog } from "@/components/dialogs";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import { ProjectCampaignsTable } from "./projectDetail/ProjectCampaignsTable";
import { ProjectDevicesTable } from "./projectDetail/ProjectDevicesTable";
import { ProjectFindingsTable } from "./projectDetail/ProjectFindingsTable";
import { ProjectOverviewTab } from "./projectDetail/ProjectOverviewTab";
import { ProjectTargetsTable } from "./projectDetail/ProjectTargetsTable";

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

  const projectData = project.data;

  async function toggleArchive() {
    try {
      await apiClient.updateProject(projectData.id, { archived: !projectData.archived });
      toast({ title: projectData.archived ? "Project restored" : "Project archived" });
      project.refetch();
      refreshProjects();
    } catch {
      toast({ title: "Could not update the project", tone: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={back}
        title={projectData.name}
        description={projectData.description || "No description"}
        actions={
          <>
            {projectData.archived && <Badge>Archived</Badge>}
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={toggleArchive}>
              {projectData.archived ? <ArchiveRestore /> : <Archive />} {projectData.archived ? "Restore" : "Archive"}
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
          <ProjectOverviewTab project={projectData} />
        </TabsContent>

        <TabsContent value="targets">
          <ProjectTargetsTable targets={targets} />
        </TabsContent>

        <TabsContent value="campaigns">
          <ProjectCampaignsTable campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="findings">
          <ProjectFindingsTable findings={findings} />
        </TabsContent>

        <TabsContent value="devices">
          <ProjectDevicesTable devices={devices} />
        </TabsContent>
      </Tabs>

      <ProjectDialog
        open={editing}
        onClose={() => setEditing(false)}
        project={projectData}
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
          await apiClient.deleteProject(projectData.id);
          refreshProjects();
          navigate("/projects");
        }}
      />
    </div>
  );
}
