import { encryptSecret, newTotpSecret, otpauthUri } from "../../services/admin/totp";
import type { AppContext } from "../../types/appEnv";
import { parseBody } from "../../validators/body";
import { ApiError } from "../../lib/errors";
import { sha256Hex } from "../../lib/tokens";
import { MfaCodeReq } from "../../validators/schemas";
import { str } from "../../lib/strings";
import { writeAudit } from "../../services/admin/audit";
import { totpKey, type AdminContext } from "./context";
import { checkSecondFactor } from "../../services/admin/secondFactor";
import { recoveryCode, startSession } from "../../services/admin/sessions";

const RECOVERY_CODES = 10;
const ALREADY_ENROLLED = "An authenticator is already set up for this account.";

export async function mfaStatus(admin: AdminContext, c: AppContext): Promise<Response> {
  const [mfa] = await admin.db.table("admin_mfa").select({ eq: { user_id: c.get("user").id } });
  const isLocked = Boolean(mfa?.locked_until && Date.parse(str(mfa.locked_until)) > admin.deps.now().getTime());
  return c.json({ email: c.get("user").email, enrolled: Boolean(mfa?.enrolled_at), locked: isLocked });
}

export async function enrollMfa(admin: AdminContext, c: AppContext): Promise<Response> {
  const user = c.get("user");
  admin.limit(`admin-enroll:${user.id}`, 5, 60_000);
  const [mfa] = await admin.db.table("admin_mfa").select({ eq: { user_id: user.id } });
  if (mfa?.enrolled_at) throw new ApiError(409, "already_enrolled", ALREADY_ENROLLED);
  const secret = newTotpSecret();
  const row = {
    user_id: user.id,
    email: str(user.email),
    secret_enc: await encryptSecret(totpKey(admin.deps), secret),
    enrolled_at: null,
    last_step: 0,
    failed_count: 0,
    locked_until: null,
    recovery_hashes: [],
  };
  await admin.db.table("admin_mfa").upsert(row, ["user_id"]);
  // the secret is shown once, to this signed-in staff member, so their app can be set up
  return c.json({ secret, otpauthUri: otpauthUri(secret, str(user.email)) });
}

export async function activateMfa(admin: AdminContext, c: AppContext): Promise<Response> {
  const user = c.get("user");
  admin.limit(`admin-mfa:${user.id}`, 10, 60_000);
  const body = await parseBody(c, MfaCodeReq);
  const [mfa] = await admin.db.table("admin_mfa").select({ eq: { user_id: user.id } });
  if (!mfa) throw new ApiError(409, "not_enrolled", "Start the authenticator setup first.");
  if (mfa.enrolled_at) throw new ApiError(409, "already_enrolled", ALREADY_ENROLLED);
  if (!body.code) throw new ApiError(400, "invalid_code", "Enter the 6-digit code from your authenticator app.");
  await checkSecondFactor(admin, c, mfa, body, true);
  const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode);
  const recoveryHashes = await Promise.all(codes.map((code) => sha256Hex(code)));
  await admin.db.table("admin_mfa").update({ user_id: user.id }, { enrolled_at: admin.deps.now().toISOString(), recovery_hashes: recoveryHashes });
  await writeAudit(admin, c, "admin.mfa_enrolled", null, null);
  return c.json({ ...(await startSession(admin, c)), recoveryCodes: codes });
}

export async function verifyMfa(admin: AdminContext, c: AppContext): Promise<Response> {
  const user = c.get("user");
  admin.limit(`admin-mfa:${user.id}`, 10, 60_000);
  const body = await parseBody(c, MfaCodeReq);
  const [mfa] = await admin.db.table("admin_mfa").select({ eq: { user_id: user.id } });
  if (!mfa?.enrolled_at) throw new ApiError(409, "not_enrolled", "Set up an authenticator first.");
  await checkSecondFactor(admin, c, mfa, body, false);
  await writeAudit(admin, c, body.recoveryCode ? "admin.signin_recovery_code" : "admin.signin", null, null);
  return c.json(await startSession(admin, c));
}

export async function endAdminSession(admin: AdminContext, c: AppContext): Promise<Response> {
  await admin.db.table("admin_sessions").update({ id: c.get("adminSession").id }, { revoked_at: admin.deps.now().toISOString() });
  return c.body(null, 204);
}

export function adminMe(c: AppContext): Response {
  const user = c.get("user");
  return c.json({ email: user.email, name: user.name, sessionExpiresAt: c.get("adminSession").expires_at });
}
