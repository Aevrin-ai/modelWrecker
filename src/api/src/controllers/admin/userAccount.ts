import { routeParam, type AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import { ApiError } from "../../lib/errors";
import { AdminDelete, AdminProfile, AdminReason, AdminSettings, AdminSuspend } from "../../validators/schemas";
import { str } from "../../lib/strings";
import { writeAudit } from "../../services/admin/audit";
import { findUser, isStaffEmail, type AdminContext } from "./context";

type StoredSettings = { sync?: Record<string, boolean>; notifications?: Record<string, boolean> };

export async function changeSyncSettings(admin: AdminContext, c: AppContext): Promise<Response> {
  const { db } = admin;
  const body = await parseBody(c, AdminSettings);
  const user = await findUser(db, routeParam(c, "id"));
  const current = (user.settings as StoredSettings | null) ?? {};
  const sync = { metadata: true, detailedEvidence: body.sync.detailedEvidence, transcripts: body.sync.transcripts };
  await db.table("profiles").update({ id: user.id }, { settings: { ...current, sync } });
  // the same rule as the user's own Settings: turning detail off removes the copies in the cloud
  if (!sync.detailedEvidence) {
    await db.table("finding_evidence").delete({ owner_id: user.id });
    await db.table("findings").update({ owner_id: user.id, evidence_synced: true }, { evidence_synced: false });
  }
  if (!sync.transcripts) await db.table("run_transcripts").delete({ owner_id: user.id });
  await writeAudit(admin, c, "user.settings_changed", user, body.reason, { sync });
  return c.json({ ok: true });
}

export async function renameUser(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminProfile);
  const user = await findUser(admin.db, routeParam(c, "id"));
  await admin.db.table("profiles").update({ id: user.id }, { display_name: body.displayName });
  await writeAudit(admin, c, "user.renamed", user, body.reason, { from: user.display_name ?? null, to: body.displayName });
  return c.json({ ok: true });
}

export async function revokeUserDevice(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminReason);
  const user = await findUser(admin.db, routeParam(c, "id"));
  const deviceId = routeParam(c, "deviceId");
  const revoked = await admin.db.table("devices").update({ id: deviceId, owner_id: user.id }, { revoked: true });
  if (revoked.length === 0) throw new ApiError(404, "not_found", "No such device for this user.");
  await writeAudit(admin, c, "user.device_revoked", user, body.reason, { device: deviceId, name: revoked[0].name ?? null });
  return c.json({ ok: true });
}

export async function suspendUser(admin: AdminContext, c: AppContext): Promise<Response> {
  const { db, deps } = admin;
  const body = await parseBody(c, AdminSuspend);
  const user = await findUser(db, routeParam(c, "id"));
  if (str(user.id) === c.get("user").id) throw new ApiError(409, "self", "You cannot suspend your own account.");
  if (deps.authAdmin) await deps.authAdmin.setBanned(str(user.id), body.suspended);
  const suspended = { suspended_at: deps.now().toISOString(), suspended_reason: body.reason };
  const restored = { suspended_at: null, suspended_reason: null };
  await db.table("profiles").update({ id: user.id }, body.suspended ? suspended : restored);
  await writeAudit(admin, c, body.suspended ? "user.suspended" : "user.unsuspended", user, body.reason);
  return c.json({ ok: true });
}

export async function resetUserMfa(admin: AdminContext, c: AppContext): Promise<Response> {
  const body = await parseBody(c, AdminReason);
  const user = await findUser(admin.db, routeParam(c, "id"));
  if (str(user.id) === c.get("user").id) throw new ApiError(409, "self", "Ask another admin to reset your own authenticator.");
  await admin.db.table("admin_mfa").delete({ user_id: user.id });
  await admin.db.table("admin_sessions").update({ user_id: user.id }, { revoked_at: admin.deps.now().toISOString() });
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
  await db.table("payments").update({ owner_id: user.id }, { customer_email: str(user.email) });
  await writeAudit(admin, c, "user.deleted", user, body.reason, { name: user.display_name ?? null });
  // cascades to every row the user owns
  await deps.authAdmin.deleteUser(str(user.id));
  return c.json({ ok: true });
}
