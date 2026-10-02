import { useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, MonitorSmartphone, MoreHorizontal, Pencil, PlugZap, ShieldOff } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { DeviceStatusBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonCards } from "@/components/States";
import { ConfirmDialog, RenameDialog } from "@/components/dialogs";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Device } from "@/types";

export function Devices() {
  const { activeProjectId } = useActiveProject();
  const { toast } = useToast();
  const devices = useAsync(() => apiClient.listDevices({ projectId: activeProjectId ?? undefined }), [activeProjectId]);
  const [renaming, setRenaming] = useState<Device | null>(null);
  const [revoking, setRevoking] = useState<Device | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Local ModelWrecker engines linked to this workspace. Each one runs attacks on its own machine."
        actions={
          <Link to="/connect" className={buttonClasses("default")}>
            <PlugZap /> Connect an engine
          </Link>
        }
      />

      <DataState
        loading={devices.loading}
        error={devices.error}
        data={devices.data}
        onRetry={devices.refetch}
        errorTitle="Unable to load devices."
        skeleton={<SkeletonCards count={3} className="md:grid-cols-2 xl:grid-cols-3" />}
        empty={
          <EmptyState
            icon={MonitorSmartphone}
            title="No engines connected"
            description="Run the ModelWrecker engine on your machine with Docker, then link it here."
            action={
              <Link to="/connect" className={buttonClasses("default")}>
                <PlugZap /> Setup instructions
              </Link>
            }
          />
        }
      >
        {(rows) => (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((d) => (
              <Card key={d.id} className="flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-md border bg-muted/40">
                      <Cpu className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.os}</p>
                    </div>
                  </div>
                  <Dropdown
                    align="end"
                    label={`Actions for ${d.name}`}
                    trigger={
                      <span className={buttonClasses("ghost", "icon")}>
                        <MoreHorizontal />
                      </span>
                    }
                  >
                    {(close) => (
                      <>
                        <DropdownItem
                          onClick={() => {
                            close();
                            setRenaming(d);
                          }}
                        >
                          <Pencil className="size-4" /> Rename
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => {
                            close();
                            setRevoking(d);
                          }}
                          className="text-destructive"
                        >
                          <ShieldOff className="size-4" /> Revoke access
                        </DropdownItem>
                      </>
                    )}
                  </Dropdown>
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <DeviceStatusBadge status={d.status} />
                  <span className={cn("text-xs", d.engineHealthy ? "text-muted-foreground" : "text-destructive")}>
                    {d.engineHealthy ? "Engine healthy" : "Engine reported a problem"}
                  </span>
                </div>

                <dl className="mt-5 space-y-2 text-sm">
                  <Row k="ModelWrecker" v={`v${d.engineVersion}`} />
                  <Row k="Last seen" v={relativeTime(d.lastSeenAt)} />
                  <Row k="Last sync" v={d.lastSyncAt ? relativeTime(d.lastSyncAt) : "Never"} />
                  <Row k="Project" v={d.projectName ?? "Unassigned"} />
                  <Row k="Fingerprint" v={d.fingerprint} mono />
                </dl>

                {d.status === "offline" && (
                  <p className="mt-5 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Offline since {formatDateTime(d.lastSeenAt)}. Campaign results will sync when the engine reconnects.
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </DataState>

      {renaming && (
        <RenameDialog
          open
          onClose={() => setRenaming(null)}
          title="Rename device"
          initial={renaming.name}
          onSave={async (name) => {
            await apiClient.renameDevice(renaming.id, name);
            devices.refetch();
          }}
        />
      )}
      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title={`Revoke ${revoking?.name ?? "device"}?`}
        description="This revokes the device's scoped sync token. The engine keeps working in local-only mode, but it can no longer sync to this workspace."
        confirmLabel="Revoke access"
        destructive
        onConfirm={async () => {
          if (!revoking) return;
          await apiClient.revokeDevice(revoking.id);
          toast({ title: "Device revoked", description: "It now runs in local-only mode." });
          devices.refetch();
        }}
      />
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={cn("truncate text-right font-medium", mono && "font-mono text-xs")}>{v}</dd>
    </div>
  );
}
