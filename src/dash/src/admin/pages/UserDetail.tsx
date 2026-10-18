import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { DataState, SkeletonCards } from "@/components/States";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import { adminClient } from "../client";
import { AuditCard } from "./userDetail/AuditCard";
import { BonusCard } from "./userDetail/BonusCard";
import { CreditCard } from "./userDetail/CreditCard";
import { DangerZone } from "./userDetail/DangerZone";
import { DevicesCard } from "./userDetail/DevicesCard";
import { PaymentsCard } from "./userDetail/PaymentsCard";
import { SettingsCard } from "./userDetail/SettingsCard";
import { SubscriptionCard } from "./userDetail/SubscriptionCard";
import { UsageCard } from "./userDetail/UsageCard";
import { UserDialogs } from "./userDetail/UserDialogs";
import { UserHeader } from "./userDetail/UserHeader";
import type { UserAction } from "./userDetail/userDetailAction";

export function UserDetail() {
  const { id = "" } = useParams();
  const user = useAsync(() => adminClient.user(id), [id]);
  const [action, setAction] = useState<UserAction>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDone = (title: string) => {
    toast({ title });
    user.refetch();
  };

  return (
    <div className="space-y-6">
      <Link to="/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Users
      </Link>
      <DataState loading={user.loading} error={user.error} data={user.data} onRetry={user.refetch} skeleton={<SkeletonCards count={4} className="lg:grid-cols-2" />}>
        {(detail) => (
          <>
            <UserHeader user={detail} onRename={() => setAction({ kind: "rename" })} />
            <div className="grid gap-4 lg:grid-cols-3">
              <SubscriptionCard user={detail} onChange={() => setAction({ kind: "plan" })} />
              <CreditCard user={detail} onAdjust={() => setAction({ kind: "credit" })} />
              <BonusCard user={detail} onSet={() => setAction({ kind: "bonus" })} />
            </div>
            <UsageCard user={detail} />
            <PaymentsCard
              user={detail}
              onRefund={(payment) => setAction({ kind: "refund", paymentId: payment.id, number: payment.number, amount: payment.amount })}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <DevicesCard user={detail} onRevoke={(device) => setAction({ kind: "revoke", deviceId: device.id, name: device.name })} />
              <SettingsCard user={detail} onEdit={() => setAction({ kind: "sync" })} />
            </div>
            <DangerZone user={detail} onAction={(kind) => setAction({ kind } as UserAction)} />
            <AuditCard user={detail} />
            <UserDialogs
              user={detail}
              action={action}
              onClose={() => setAction(null)}
              onDone={handleDone}
              onDeleted={() => {
                toast({ title: "User deleted" });
                navigate("/users", { replace: true });
              }}
            />
          </>
        )}
      </DataState>
    </div>
  );
}
