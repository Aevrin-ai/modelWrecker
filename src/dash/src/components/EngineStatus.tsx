import { Link } from "react-router-dom";
import { HardDrive, PlugZap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState, EmptyState } from "@/components/States";
import { apiClient } from "@/api";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Device } from "@/types";

/** Pick the device to headline: the most recently seen online one, else the most recent. */
function headline(devices: Device[]): Device | null {
  const sorted = [...devices].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  return sorted.find((d) => d.status !== "offline") ?? sorted[0] ?? null;
}

/**
 * "ModelWrecker Engine - Connected / Offline". Shows only what the device reported
 * through authenticated sync. It never implies the cloud is running anything.
 */
export function EngineStatusCard({ projectId, className }: { projectId?: string; className?: string }) {
  const { data, loading, error, refetch } = useAsync(() => apiClient.listDevices({ projectId }), [projectId]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <HardDrive className="size-4 text-muted-foreground" />
          ModelWrecker Engine
        </CardTitle>
        <CardDescription>Your local compute plane.</CardDescription>
      </CardHeader>
      <CardContent>
        <DataState
          loading={loading}
          error={error}
          data={data}
          onRetry={refetch}
          errorTitle="Unable to load engine status."
          skeleton={
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          }
          empty={
            <EmptyState
              icon={PlugZap}
              title="No engine connected"
              description="Install ModelWrecker on your machine and register it as a device."
              className="p-6"
              action={
                <Link to="/connect" className={buttonClasses("default", "sm")}>
                  Connect ModelWrecker
                </Link>
              }
            />
          }
        >
          {(devices) => {
            const d = headline(devices)!;
            const online = d.status !== "offline";
            const others = devices.filter((x) => x.status !== "offline").length;
            return (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      online ? "bg-success" : "border-2 border-muted-foreground bg-transparent",
                    )}
                  />
                  {online ? (d.status === "syncing" ? "Connected - syncing" : "Connected") : "Offline"}
                </p>
                <dl className="space-y-1.5 text-sm">
                  <Row label="Device">{d.name}</Row>
                  <Row label="Version">ModelWrecker {d.engineVersion}</Row>
                  {online ? (
                    <Row label="Last sync">{relativeTime(d.lastSyncAt)}</Row>
                  ) : (
                    <Row label="Last seen">{formatDateTime(d.lastSeenAt)}</Row>
                  )}
                </dl>
                {!online && (
                  <p className="text-xs text-muted-foreground">
                    Campaign results will synchronize when the engine reconnects.
                  </p>
                )}
                {online && others > 1 && (
                  <p className="text-xs text-muted-foreground">{others} engines online in scope.</p>
                )}
                <Link
                  to={online ? "/devices" : "/connect"}
                  className={buttonClasses("outline", "sm", "w-full")}
                >
                  {online ? "Manage device" : "View setup instructions"}
                </Link>
              </div>
            );
          }}
        </DataState>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{children}</dd>
    </div>
  );
}
