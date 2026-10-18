import { routeParam, type AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import { ApiError } from "../../lib/errors";
import { AdminDelete, AdminProfile, AdminReason, AdminSettings, AdminSuspend } from "../../validators/schemas";
import { str } from "../../lib/strings";
import { writeAudit } from "../../services/admin/audit";
import { findUser, isStaffEmail, type AdminContext } from "./context";
import { adminMfaRepository } from "../../repositories/adminMfa";
import { adminSessionsRepository } from "../../repositories/adminSessions";
import { devicesRepository } from "../../repositories/devices";
import { findingEvidenceRepository } from "../../repositories/findingEvidence";
import { findingsRepository } from "../../repositories/findings";
import { paymentsRepository } from "../../repositories/payments";
import { profilesRepository } from "../../repositories/profiles";
import { runTranscriptsRepository } from "../../repositories/runTranscripts";

type StoredSettings = { sync?: Record<string, boolean>; notifications?: Record<string, boolean> };

export async function changeSyncSettings(admin: AdminContext, c: AppContext): Promise<Response> {
  const { db } = admin;
  const body = await parseBody(c, AdminSettings);
  const user = await findUser(db, routeParam(c, "id"));
  const userId = str(user.id);
  const current = (user.settings as StoredSettings | null) ?? {};
  const sync = { metadata: true, detailedEvidence: body.sync.detailedEvidence, transcripts: body.sync.transcripts };
  await profilesRepository(db).saveSettings(userId, { ...current, sync });
  // the same rule as the user's own Settings: turning detail off removes the copies in the cloud
  if (!sync.detailedEvidence) {
    await findingEvidenceRepository(db).deleteForOwner(userId);
    await findingsRepository(db).clearEvidenceFlagsForOwner(userId);
  }
  if (!sync.transcripts) await runTranscriptsRepository(db).deleteForOwner(userId);
  await writeAudit(admin, c, "user.settings_changed", user, body.reason, { sync });
  return c.json({ ok: true });
}

export async function renameUser(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminProfile);
  const user = await findUser(admin.db, routeParam(c, "id"));
  await profilesRepository(admin.db).rename(str(user.id), body.displayName);
  await writeAudit(admin, c, "user.renamed", user, body.reason, { from: user.display_name ?? null, to: body.displayName });
  return c.json({ ok: true });
}

export async function revokeUserDevice(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminReason);
  const user = await findUser(admin.db, routeParam(c, "id"));
  const deviceId = routeParam(c, "deviceId");
  const revoked = await devicesRepository(admin.db).revokeForOwner(deviceId, str(user.id));
  if (!revoked) throw new ApiError(404, "not_found", "No such device for this user.");
  await writeAudit(admin, c, "user.device_revoked", user, body.reason, { device: deviceId, name: revoked.name ?? null });
  return c.json({ ok: true });
}

export async function suspendUser(admin: AdminContext, c: AppContext): Promise<Response> {
  const { db, deps } = admin;
  const body = await parseBody(c, AdminSuspend);
  const user = await findUser(db, routeParam(c, "id"));
  if (str(user.id) === c.get("user").id) throw new ApiError(409, "self", "You cannot suspend your own account.");
  if (deps.authAdmin) await deps.authAdmin.setBanned(str(user.id), body.suspended);
  const profiles = profilesRepository(db);
  if (body.suspended) await profiles.setSuspended(str(user.id), deps.now().toISOString(), body.reason);
  else await profiles.setSuspended(str(user.id), null, null);
  await writeAudit(admin, c, body.suspended ? "user.suspended" : "user.unsuspended", user, body.reason);
  return c.json({ ok: true });
}

export async function resetUserMfa(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminReason);
  const user = await findUser(admin.db, routeParam(c, "id"));
  if (str(user.id) === c.get("user").id) throw new ApiError(409, "self", "Ask another admin to reset your own authenticator.");
  await adminMfaRepository(admin.db).deleteForUser(str(user.id));
  await adminSessionsRepository(admin.db).revokeAllForUser(str(user.id), admin.deps.now().toISOString());
  await writeAudit(admin, c, "admin.mfa_reset", user, body.reason);
  return c.json({ ok: true });
}

export async function deleteUser(admin: AdminContext, c: AppContext): Promise<Response> {
  const { db, deps } = admin;
  const body = await parseBody(c, AdminDelete);
  const user = await findUser(db, routeParam(c, "id"));
  if (str(user.id) === c.get("user").id) throw new ApiError(409, "self", "You cannot delete your own account here.");
  if (isStaffEmail(str(user.email))) throw new ApiError(409, "staff", "Staff accounts are removed by the domain owner, not from the console.");
  if (body.confirmEmail.toLowerCase() !== str(user.email).toLowerCase()) {
    throw new ApiError(422, "confirm_mismatch", "Type the user's email exactly to confirm.");
  }
  if (!deps.authAdmin) throw new ApiError(503, "admin_unavailable", "Account deletion is not configured.");
  // payments are financial records: keep them, detached from the account, with the email they were for
  await paymentsRepository(db).keepEmailForOwner(str(user.id), str(user.email));
  await writeAudit(admin, c, "user.deleted", user, body.reason, { name: user.display_name ?? null });
  // cascades to every row the user owns
  await deps.authAdmin.deleteUser(str(user.id));
  return c.json({ ok: true });
}
