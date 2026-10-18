import type { AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import type { Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { SettingsPatch } from "../../validators/schemas";
import { planFor, userScope } from "./context";
import { readSettings, isTurningDetailOn, deleteDetailTurnedOff } from "../../services/dashboard/settings";
import { profilesRepository } from "../../repositories/profiles";

export async function getSettings(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  return c.json(await readSettings(db, owner));
}

export async function updateSettings(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const body = await parseBody(c, SettingsPatch);
  const current = await readSettings(db, owner);
  if (isTurningDetailOn(current, body.sync) && !(await planFor(deps, owner, deps.now())).features.evidence_storage) {
    throw new ApiError(403, "upgrade_required", "Evidence and transcript sync are part of Pro.");
  }
  const next = {
    sync: { ...current.sync, ...(body.sync ?? {}), metadata: true },
    notifications: { ...current.notifications, ...(body.notifications ?? {}) },
  };
  await profilesRepository(db).saveSettings(owner, next);
  await deleteDetailTurnedOff(db, owner, current, next);
  return c.json(next);
}
