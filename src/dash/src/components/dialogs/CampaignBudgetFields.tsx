import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { STOP_CONDITION_LABEL } from "@/lib/constants";
import type { Campaign } from "@/types";
import type { CampaignForm, SetCampaignField } from "./campaignForm";

export interface CampaignBudgetFieldsProps {
  form: CampaignForm;
  errors: Record<string, string>;
  onFieldChange: SetCampaignField;
}

export function CampaignBudgetFields({ form, errors, onFieldChange }: CampaignBudgetFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Objectives" htmlFor="c-obj" error={errors.objectiveCount}>
        <Input id="c-obj" type="number" min={1} value={form.objectiveCount} onChange={(e) => onFieldChange("objectiveCount", Number(e.target.value))} />
      </Field>
      <Field label="Stop condition" htmlFor="c-stop">
        <Select id="c-stop" value={form.stopCondition} onChange={(e) => onFieldChange("stopCondition", e.target.value as Campaign["stopCondition"])} className="w-full">
          {(Object.keys(STOP_CONDITION_LABEL) as Campaign["stopCondition"][]).map((condition) => (
            <option key={condition} value={condition}>
              {STOP_CONDITION_LABEL[condition]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Concurrency" htmlFor="c-conc" error={errors.concurrency} hint="Objectives run in parallel on the engine.">
        <Input id="c-conc" type="number" min={1} max={32} value={form.concurrency} onChange={(e) => onFieldChange("concurrency", Number(e.target.value))} />
      </Field>
      <Field label="Max attempts" htmlFor="c-max" error={errors.maxAttempts} hint="Attack budget. Leave empty for no attempt cap.">
        <Input
          id="c-max"
          type="number"
          min={1}
          value={form.maxAttempts ?? ""}
          onChange={(e) => onFieldChange("maxAttempts", e.target.value === "" ? null : Number(e.target.value))}
        />
      </Field>
    </div>
  );
}
