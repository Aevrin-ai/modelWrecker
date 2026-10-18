import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { apiClient } from "@/api";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import type { Target } from "@/types";
import { targetSchema } from "./dialogSchemas";
import { FormActions } from "./FormActions";
import { errorText, fieldErrors } from "./formErrors";
import { TargetAuthorizationField } from "./TargetAuthorizationField";
import { TargetFields } from "./TargetFields";
import { emptyTargetForm, type SetTargetField } from "./targetForm";

export interface TargetDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (target: Target) => void;
}

// stores registration metadata only; the dashboard never connects to the target
export function TargetDialog({ open, onClose, onSaved }: TargetDialogProps) {
  const { projects, activeProjectId } = useActiveProject();
  const { toast } = useToast();
  const liveProjects = projects.filter((project) => !project.archived);
  const [form, setForm] = useState(emptyTargetForm(""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(emptyTargetForm(activeProjectId ?? liveProjects[0]?.id ?? ""));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setField: SetTargetField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = targetSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      return;
    }
    setBusy(true);
    try {
      const target = await apiClient.createTarget(parsed.data);
      toast({ title: "Target registered", description: `${target.name} is ready for campaigns.` });
      onSaved?.(target);
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
      title="Register target"
      description="Record the AI system you are allowed to test. The dashboard stores this metadata only; it never connects to the target."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        <TargetFields form={form} errors={errors} liveProjects={liveProjects} onFieldChange={setField} />
        <TargetAuthorizationField isAuthorized={form.authorized} error={errors.authorized} onChange={(isAuthorized) => setField("authorized", isAuthorized)} />
        {errors.form && <p className="text-sm font-medium text-destructive">{errors.form}</p>}
        <FormActions isBusy={busy} submitLabel={busy ? "Registering..." : "Register target"} onClose={onClose} />
      </form>
    </Dialog>
  );
}
