import { routeParam, type AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { NamePatch } from "../../validators/schemas";
import { NOT_FOUND_MESSAGE, findOwned, queryParam, userScope } from "./context";
import { mapDevice } from "../../services/dashboard/views/deviceView";
import { loadWorld, scope } from "../../services/dashboard/world";
import { devicesRepository } from "../../repositories/devices";

export async function listDevices(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const world = await loadWorld(db, owner);
  const devices = scope(world, queryParam(c, "projectId")).devices;
  return c.json(devices.map((device) => mapDevice(device, world, now)));
}

export async function readDevice(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const device = await findOwned(db, "devices", routeParam(c, "id"), owner);
  if (device.revoked) throw new ApiError(404, "not_found", NOT_FOUND_MESSAGE);
  return c.json(mapDevice(device, await loadWorld(db, owner), now));
}

export async function renameDevice(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner, now } = userScope(c, deps);
  const body = await parseBody(c, NamePatch);
  const id = routeParam(c, "id");
  await findOwned(db, "devices", id, owner);
  const device = await devicesRepository(db).renameForOwner(id, owner, body.name);
  if (!device) throw new ApiError(404, "not_found", NOT_FOUND_MESSAGE);
  return c.json(mapDevice(device, await loadWorld(db, owner), now));
}

export async function revokeDevice(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const id = routeParam(c, "id");
  await findOwned(db, "devices", id, owner);
  await devicesRepository(db).revokeForOwner(id, owner);
  return c.body(null, 204);
}
