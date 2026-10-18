import type { AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Database, Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import type { IpLimit } from "../../middleware/rateLimit";
import { effectivePlan } from "../../services/billing/plans";
import { DeviceApproveReq } from "../../validators/schemas";
import { ensureDefaultProject } from "../../services/projects";

async function refuseOverDeviceLimit(deps: Deps, ownerId: string): Promise<void> {
  const [subscription] = await deps.serviceDb.table("subscriptions").select({ eq: { owner_id: ownerId } });
  const max = effectivePlan(subscription, deps.now()).limits.devices;
  const devices = await deps.serviceDb.table("devices").select({ eq: { owner_id: ownerId } });
  const linked = devices.filter((device) => !device.revoked).length;
  if (max !== null && linked >= max) {
    const plural = max === 1 ? "" : "s";
    throw new ApiError(403, "plan_limit", `Your plan allows ${max} connected device${plural}. Revoke one in Devices, or upgrade.`);
  }
}

// a chosen project is looked up through the user's own RLS-scoped database, so it must be theirs
async function projectForDevice(db: Database, ownerId: string, projectId: string | null): Promise<string> {
  if (!projectId) return ensureDefaultProject(db, ownerId);
  const [project] = await db.table("projects").select({ eq: { id: projectId, owner_id: ownerId } });
  if (!project) throw new ApiError(404, "unknown_project", "That project was not found.");
  return String(project.id);
}

/** The signed-in user approves or denies a device sign-in by its user code. */
export async function approveDevice(c: AppContext, deps: Deps, limit: IpLimit): Promise<Response> {
  limit(c, "device-approve", 20, 60_000);
  const body = await parseBody(c, DeviceApproveReq);
  const user = c.get("user");
  const requests = deps.serviceDb.table("device_auth_requests");
  const [request] = await requests.select({ eq: { user_code: body.user_code } });
  if (!request) throw new ApiError(404, "unknown_code", "That code was not found. Check it and try again.");
  if (new Date(String(request.expires_at)).getTime() <= deps.now().getTime()) {
    throw new ApiError(410, "expired_token", "That code has expired. Run modelwrecker login again.");
  }
  if (request.status !== "pending") throw new ApiError(409, "already_used", "That code was already used.");

  if (!body.approve) {
    await requests.update({ id: request.id, status: "pending" }, { status: "denied", owner_id: user.id });
    return c.json({ denied: true });
  }

  await refuseOverDeviceLimit(deps, user.id);
  const projectId = await projectForDevice(c.get("db"), user.id, body.project_id);
  const updated = await requests.update(
    { id: request.id, status: "pending" },
    { status: "approved", owner_id: user.id, project_id: projectId },
  );
  if (updated.length !== 1) throw new ApiError(409, "already_used", "That code was already used.");
  return c.json({ approved: true });
}
