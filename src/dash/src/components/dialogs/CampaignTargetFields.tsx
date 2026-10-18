import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { TARGET_TYPE_LABEL } from "@/lib/constants";
import type { Project, Target } from "@/types";
import type { CampaignForm, SetCampaignField } from "./campaignForm";

export interface CampaignTargetFieldsProps {
  form: CampaignForm;
  errors: Record<string, string>;
  liveProjects: Project[];
  projectTargets: Target[];
  target: Target | undefined;
  onFieldChange: SetCampaignField;
  onProjectChange: (projectId: string) => void;
}

export function CampaignTargetFields({ form, errors, liveProjects, projectTargets, target, onFieldChange, onProjectChange }: CampaignTargetFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Campaign name" htmlFor="c-name" error={errors.name} className="sm:col-span-2">
        <Input id="c-name" value={form.name} onChange={(e) => onFieldChange("name", e.target.value)} placeholder="Weekly jailbreak regression" />
      </Field>
      <Field label="Project" htmlFor="c-project" error={errors.projectId}>
        <Select id="c-project" value={form.projectId} onChange={(e) => onProjectChange(e.target.value)} className="w-full">
          {liveProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Target" htmlFor="c-target" error={errors.targetId} hint={target && !target.authorized ? "This target is not authorized yet; it cannot be marked ready." : undefined}>
        <Select id="c-target" value={form.targetId} onChange={(e) => onFieldChange("targetId", e.target.value)} className="w-full">
          {projectTargets.length === 0 && <option value="">No targets in this project</option>}
          {projectTargets.map((projectTarget) => (
            <option key={projectTarget.id} value={projectTarget.id}>
              {projectTarget.name} ({TARGET_TYPE_LABEL[projectTarget.type]})
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
