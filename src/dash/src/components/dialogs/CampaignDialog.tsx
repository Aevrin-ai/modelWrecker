import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { RunsLocallyChip } from "@/components/LocalBoundary";
import { apiClient } from "@/api";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import { STRATEGIES } from "@/lib/constants";
import type { Campaign, Target } from "@/types";
import { CampaignBudgetFields } from "./CampaignBudgetFields";
import { emptyCampaignForm, type SetCampaignField } from "./campaignForm";
import { CampaignStrategyPicker } from "./CampaignStrategyPicker";
import { CampaignTargetFields } from "./CampaignTargetFields";
import { campaignSchema } from "./dialogSchemas";
import { FormActions } from "./FormActions";
import { errorText, fieldErrors } from "./formErrors";

export interface CampaignDialogProps {
  open: boolean;
  onClose: () => void;
  targets: Target[];
  onSaved?: (campaign: Campaign) => void;
}

// saves a draft only; nothing runs until the local engine picks it up
export function CampaignDialog({ open, onClose, targets, onSaved }: CampaignDialogProps) {
  const { projects, activeProjectId } = useActiveProject();
  const { toast } = useToast();
  const liveProjects = projects.filter((project) => !project.archived);
  const [form, setForm] = useState(emptyCampaignForm("", ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const projectId = activeProjectId ?? liveProjects[0]?.id ?? "";
      const firstTarget = targets.find((candidate) => candidate.projectId === projectId);
      setForm(emptyCampaignForm(projectId, firstTarget?.id ?? ""));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projectTargets = useMemo(() => targets.filter((candidate) => candidate.projectId === form.projectId), [targets, form.projectId]);
  const target = targets.find((candidate) => candidate.id === form.targetId);
  const available = STRATEGIES.filter((strategy) => !target || strategy.targets.includes(target.type));

  const setField: SetCampaignField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function handleProjectChange(projectId: string) {
    setForm((current) => ({ ...current, projectId, targetId: targets.find((candidate) => candidate.projectId === projectId)?.id ?? "" }));
  }

  function toggleStrategy(strategyId: string, isOn: boolean) {
    setField("strategies", isOn ? [...form.strategies, strategyId] : form.strategies.filter((selectedId) => selectedId !== strategyId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = campaignSchema.safeParse({
      ...form,
      strategies: form.strategies.filter((selectedId) => available.some((strategy) => strategy.id === selectedId)),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setBusy(true);
    try {
      const campaign = await apiClient.createCampaign(parsed.data);
      toast({ title: "Campaign saved as draft", description: "Mark it ready when you want your local engine to run it." });
      onSaved?.(campaign);
      onClose();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New campaign"
      description="Configure a campaign. It is saved as a draft; nothing runs until your local engine picks it up."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        <RunsLocallyChip />
        <CampaignTargetFields
          form={form}
          errors={errors}
          liveProjects={liveProjects}
          projectTargets={projectTargets}
          target={target}
          onFieldChange={setField}
          onProjectChange={handleProjectChange}
        />
        <CampaignStrategyPicker available={available} selected={form.strategies} error={errors.strategies} onToggle={toggleStrategy} />
        <CampaignBudgetFields form={form} errors={errors} onFieldChange={setField} />
        {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
        <FormActions isBusy={busy} submitLabel={busy ? "Saving..." : "Save as draft"} onClose={onClose} />
      </form>
    </Dialog>
  );
}
