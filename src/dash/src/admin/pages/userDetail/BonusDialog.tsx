import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { METER_LABEL, METER_ORDER } from "@/lib/plans";
import type { MeterKey } from "@/types";
import { ActionDialog } from "../../ActionDialog";
import { adminClient } from "../../client";
import { dateInput, endOfDay, type UserDialogProps } from "./userDetailAction";

export function BonusDialog({ user, open, onClose, onDone }: UserDialogProps) {
  const currentBonus = user.subscription.bonus;
  const [bonus, setBonus] = useState<Record<MeterKey, number>>({
    campaigns: currentBonus.campaigns,
    attacks: currentBonus.attacks,
    devices: currentBonus.devices,
    projects: currentBonus.projects,
  });
  const [bonusUntil, setBonusUntil] = useState(dateInput(currentBonus.expires_at));

  return (
    <ActionDialog
      open={open}
      onClose={onClose}
      title="Bonus allowance"
      description="Added to the plan's monthly limits. Set all to 0 to remove the bonus."
      confirmLabel="Save bonus"
      onSubmit={async (reason) => {
        await adminClient.setBonus(user.id, { ...bonus, expiresAt: bonusUntil ? endOfDay(bonusUntil) : null }, reason);
        onDone("Bonus saved");
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {METER_ORDER.map((meter) => (
          <Field key={meter} label={`+ ${METER_LABEL[meter].label}`} htmlFor={`adm-b-${meter}`}>
            <Input
              id={`adm-b-${meter}`}
              type="number"
              min={0}
              value={bonus[meter]}
              onChange={(e) => setBonus({ ...bonus, [meter]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </Field>
        ))}
      </div>
      <Field label="Until" htmlFor="adm-b-until" hint="Leave empty for no end date.">
        <Input id="adm-b-until" type="date" value={bonusUntil} onChange={(e) => setBonusUntil(e.target.value)} />
      </Field>
    </ActionDialog>
  );
}
