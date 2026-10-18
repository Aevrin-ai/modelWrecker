import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, Textarea } from "@/components/ui/field";
import { apiClient } from "@/api";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import type { Project } from "@/types";
import { projectSchema } from "./dialogSchemas";
import { FormActions } from "./FormActions";
import { errorText, fieldErrors } from "./formErrors";

export interface ProjectDialogProps {
  open: boolean;
  onClose: () => void;
  project?: Project | null; // when set, edits this project; otherwise creates a new one
  onSaved?: (project: Project) => void;
}

export function ProjectDialog({ open, onClose, project, onSaved }: ProjectDialogProps) {
  const { refreshProjects } = useActiveProject();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setErrors({});
    }
  }, [open, project]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = projectSchema.safeParse({ name, description });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setBusy(true);
    try {
      const saved = project
        ? await apiClient.updateProject(project.id, parsed.data)
        : await apiClient.createProject(parsed.data);
      refreshProjects();
      toast({ title: project ? "Project updated" : "Project created", description: saved.name });
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const idleLabel = project ? "Save changes" : "Create project";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description="A project groups the targets, campaigns, devices, and findings for one system under test."
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        <Field label="Project name" htmlFor="project-name" error={errors.name}>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme AI Assistant" />
        </Field>
        <Field label="Description" htmlFor="project-desc" error={errors.description} hint="Optional. What system does this project test?">
          <Textarea id="project-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
        <FormActions isBusy={busy} submitLabel={busy ? "Saving..." : idleLabel} onClose={onClose} />
      </form>
    </Dialog>
  );
}
