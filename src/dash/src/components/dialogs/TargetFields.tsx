import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { TARGET_TYPE_DESCRIPTION, TARGET_TYPE_LABEL, TARGET_TYPES } from "@/lib/constants";
import type { Project, TargetType } from "@/types";
import type { SetTargetField, TargetForm } from "./targetForm";

export interface TargetFieldsProps {
  form: TargetForm;
  errors: Record<string, string>;
  liveProjects: Project[];
  onFieldChange: SetTargetField;
}

export function TargetFields({ form, errors, liveProjects, onFieldChange }: TargetFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Target name" htmlFor="t-name" error={errors.name} className="sm:col-span-2">
        <Input id="t-name" value={form.name} onChange={(e) => onFieldChange("name", e.target.value)} placeholder="Production Support Chat" />
      </Field>
      <Field label="Target type" htmlFor="t-type" hint={TARGET_TYPE_DESCRIPTION[form.type]}>
        <Select id="t-type" value={form.type} onChange={(e) => onFieldChange("type", e.target.value as TargetType)} className="w-full">
          {TARGET_TYPES.map((type) => (
            <option key={type} value={type}>
              {TARGET_TYPE_LABEL[type]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Project" htmlFor="t-project" error={errors.projectId}>
        <Select id="t-project" value={form.projectId} onChange={(e) => onFieldChange("projectId", e.target.value)} className="w-full">
          {liveProjects.length === 0 && <option value="">No projects yet</option>}
          {liveProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Provider" htmlFor="t-provider" error={errors.provider}>
        <Input id="t-provider" value={form.provider} onChange={(e) => onFieldChange("provider", e.target.value)} placeholder="OpenAI-compatible" />
      </Field>
      <Field label="Model" htmlFor="t-model" error={errors.model}>
        <Input id="t-model" value={form.model} onChange={(e) => onFieldChange("model", e.target.value)} placeholder="llama3" />
      </Field>
      <Field
        label="Endpoint"
        htmlFor="t-endpoint"
        error={errors.endpoint}
        hint="Host or path only. API keys stay in the local engine's environment, never here."
        className="sm:col-span-2"
      >
        <Input id="t-endpoint" value={form.endpoint} onChange={(e) => onFieldChange("endpoint", e.target.value)} placeholder="localhost:11434" />
      </Field>
    </div>
  );
}
