import type { Row } from "../../../types/deps";
import { str } from "../../../lib/strings";
import { ONLINE_WINDOW_MS, byId, latest } from "../rows";
import type { World } from "../world";

/** A device row as the dashboard's Device type. */
export function mapDevice(device: Row, world: World, now: Date) {
  const lastSeen = str(device.last_seen_at ?? device.created_at);
  const deviceRuns = world.runs.filter((run) => str(run.device_id) === str(device.id));
  const lastSync = latest(deviceRuns.map((run) => str(run.created_at)));
  const isOnline = lastSeen && now.getTime() - Date.parse(lastSeen) < ONLINE_WINDOW_MS;
  return {
    id: str(device.id),
    name: str(device.name),
    status: isOnline ? "online" : "offline",
    engineVersion: str(device.engine_version),
    os: str(device.os),
    lastSeenAt: lastSeen,
    lastSyncAt: lastSync ?? null,
    projectId: device.project_id ? str(device.project_id) : null,
    projectName: device.project_id ? str(byId(world.projects).get(str(device.project_id))?.name) || null : null,
    engineHealthy: true,
    fingerprint: str(device.id).slice(0, 8),
  };
}
