import { formatCurrency } from "@/lib/format";
import { ActionDialog } from "../../ActionDialog";
import { adminClient } from "../../client";
import type { UserDetail as Detail } from "../../client";
import { BonusDialog } from "./BonusDialog";
import { CreditDialog } from "./CreditDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { PlanDialog } from "./PlanDialog";
import { RenameUserDialog } from "./RenameUserDialog";
import { SyncDialog } from "./SyncDialog";
import type { UserAction } from "./userDetailAction";

export interface UserDialogsProps {
  user: Detail;
  action: UserAction;
  onClose: () => void;
  onDone: (title: string) => void;
  onDeleted: () => void;
}

export function UserDialogs({ user, action, onClose, onDone, onDeleted }: UserDialogsProps) {
  const kind = action?.kind;
  const dialogProps = { user, onClose, onDone };

  return (
    <>
      <PlanDialog {...dialogProps} open={kind === "plan"} />
      <BonusDialog {...dialogProps} open={kind === "bonus"} />
      <CreditDialog {...dialogProps} open={kind === "credit"} />
      <SyncDialog {...dialogProps} open={kind === "sync"} />
      <RenameUserDialog {...dialogProps} open={kind === "rename"} />

      <ActionDialog
        open={kind === "suspend"}
        onClose={onClose}
        title={user.suspendedAt ? "Restore access" : "Suspend account"}
        description={
          user.suspendedAt
            ? "The user can sign in, use the dashboard, and sync again."
            : "The user is signed out at their next token refresh, cannot use the dashboard or API, and their devices stop syncing. Nothing is deleted."
        }
        destructive={!user.suspendedAt}
        confirmLabel={user.suspendedAt ? "Restore access" : "Suspend"}
        onSubmit={async (reason) => {
          await adminClient.suspend(user.id, !user.suspendedAt, reason);
          onDone(user.suspendedAt ? "Access restored" : "Account suspended");
        }}
      />

      <ActionDialog
        open={kind === "reset-mfa"}
        onClose={onClose}
        title="Reset authenticator"
        description="Ends this admin's sessions and removes their authenticator. They set up a new one at their next admin sign-in."
        destructive
        confirmLabel="Reset authenticator"
        onSubmit={async (reason) => {
          await adminClient.resetMfa(user.id, reason);
          onDone("Authenticator reset");
        }}
      />

      <DeleteUserDialog user={user} open={kind === "delete"} onClose={onClose} onDeleted={onDeleted} />

      <ActionDialog
        open={kind === "refund"}
        onClose={onClose}
        title="Refund payment"
        description={action?.kind === "refund" ? `Refunds invoice ${action.number} (${formatCurrency(action.amount)}) in full through Razorpay and takes back the time it bought. Any credit used on it is returned.` : ""}
        destructive
        confirmLabel="Refund in full"
        onSubmit={async (reason) => {
          if (action?.kind !== "refund") return;
          await adminClient.refund(user.id, action.paymentId, reason);
          onDone("Refund issued");
        }}
      />

      <ActionDialog
        open={kind === "revoke"}
        onClose={onClose}
        title="Revoke device"
        description={action?.kind === "revoke" ? `"${action.name}" can no longer sync or fetch entitlements. The user can sign it in again with modelwrecker login.` : ""}
        destructive
        confirmLabel="Revoke"
        onSubmit={async (reason) => {
          if (action?.kind !== "revoke") return;
          await adminClient.revokeDevice(user.id, action.deviceId, reason);
          onDone("Device revoked");
        }}
      />
    </>
  );
}
