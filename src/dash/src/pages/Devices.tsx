import { useState } from "react";
import { Link } from "react-router-dom";
import { MonitorSmartphone, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { buttonClasses } from "@/components/ui/button";
import { DataState, EmptyState, SkeletonCards } from "@/components/States";
import { ConfirmDialog, RenameDialog } from "@/components/dialogs";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useToast } from "@/hooks/useToast";
import type { Device } from "@/types";
import { DeviceCard } from "./devices/DeviceCard";

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
            {rows.map((device) => (
              <DeviceCard key={device.id} device={device} onRename={setRenaming} onRevoke={setRevoking} />
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
