import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { formatPaise } from "@/lib/plans";
import { ActionDialog } from "../../ActionDialog";
import { adminClient } from "../../client";
import type { UserDialogProps } from "./userDetailAction";

export function CreditDialog({ user, open, onClose, onDone }: UserDialogProps) {
  const [rupees, setRupees] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Account credit"
      description={`Balance now: ${formatPaise(user.subscription.creditPaise)}. Credit is taken off the user's next purchase. It is not cash and cannot go below zero.`}
      confirmLabel={direction === "add" ? "Add credit" : "Remove credit"}
      canSubmit={Number(rupees) > 0}
      onSubmit={async (reason) => {
        const paise = Math.round(Number(rupees) * 100);
        await adminClient.adjustCredit(user.id, direction === "add" ? paise : -paise, reason);
        setRupees("");
        onDone("Credit updated");
      }}
    >
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Field label="Change" htmlFor="adm-c-dir">
          <div className="flex">
            <Select id="adm-c-dir" value={direction} onChange={(e) => setDirection(e.target.value as "add" | "remove")}>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </Select>
          </div>
        </Field>
        <Field label="Amount (rupees)" htmlFor="adm-c-amt">
          <Input id="adm-c-amt" type="number" min={1} step="1" value={rupees} onChange={(e) => setRupees(e.target.value)} placeholder="500" />
        </Field>
      </div>
    </ActionDialog>
  );
}
