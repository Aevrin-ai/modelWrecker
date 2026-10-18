import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeviceStatusBadge } from "@/components/StatusBadges";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { relativeTime } from "@/lib/format";
import type { AsyncState } from "@/hooks/useAsync";
import type { Device } from "@/types";

export interface ProjectDevicesTableProps {
  devices: AsyncState<Device[]>;
}

export function ProjectDevicesTable({ devices }: ProjectDevicesTableProps) {
  return (
    <DataState loading={devices.loading} error={devices.error} data={devices.data} onRetry={devices.refetch} skeleton={<SkeletonRows rows={3} cols={4} />} empty={<EmptyState title="No devices linked to this project" />}>
      {(rows) => (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell>
                    <DeviceStatusBadge status={device.status} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">v{device.engineVersion}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{relativeTime(device.lastSeenAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </DataState>
  );
}
