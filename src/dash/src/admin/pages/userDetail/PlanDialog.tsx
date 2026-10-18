import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import type { Plan } from "@/types";
import { ActionDialog } from "../../ActionDialog";
import { adminClient } from "../../client";
import { dateInput, endOfDay, type UserDialogProps } from "./userDetailAction";

export function PlanDialog({ user, open, onClose, onDone }: UserDialogProps) {
  const subscription = user.subscription;
  const [plan, setPlan] = useState<Plan["id"]>(subscription.effectivePlan);
  const [until, setUntil] = useState(dateInput(subscription.paidUntil));

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Change plan"
      description="Takes effect at once and appears in the user's next entitlement. A paid plan with no end date stays until changed."
      confirmLabel="Save plan"
      canSubmit={plan === "free" || !until || new Date(`${until}T23:59:59Z`).getTime() > Date.now()}
      onSubmit={async (reason) => {
        await adminClient.setPlan(user.id, plan, plan === "free" ? null : endOfDay(until), reason);
        onDone("Plan updated");
      }}
    >
      <Field label="Plan" htmlFor="adm-plan">
        <div className="flex [&>div]:w-full">
          <Select id="adm-plan" value={plan} onChange={(e) => setPlan(e.target.value as Plan["id"])} className="w-full">
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </Select>
        </div>
      </Field>
      {plan !== "free" && (
        <Field label="Paid until" htmlFor="adm-until" hint="Leave empty for no end date.">
          <Input id="adm-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      )}
    </ActionDialog>
  );
}
