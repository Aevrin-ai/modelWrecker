import { decryptSecret, verifyTotp } from "./totp";
import type { AppContext } from "../../types/appEnv";
import type { Row } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { sha256Hex } from "../../lib/tokens";
import { str } from "../../lib/strings";
import { writeAudit } from "./audit";
import { totpKey, type AdminContext } from "../../controllers/admin/context";

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;

interface SecondFactorBody {
  code?: string;
  recoveryCode?: string;
}

/** The changes to store when the code matches, or null when it does not. */
async function matchSecondFactor(admin: AdminContext, mfa: Row, body: SecondFactorBody, isPending: boolean, now: Date): Promise<Row | null> {
  if (body.code) {
    const secret = await decryptSecret(totpKey(admin.deps), str(mfa.secret_enc));
    const step = await verifyTotp(secret, body.code, now.getTime(), Number(mfa.last_step ?? 0));
    return step === null ? null : { last_step: step };
  }
  if (!body.recoveryCode || isPending) return null;
  const hash = await sha256Hex(body.recoveryCode.trim().toUpperCase());
  const stored = (mfa.recovery_hashes as string[]) ?? [];
  const left = stored.filter((storedHash) => storedHash !== hash);
  // each recovery code works once
  return left.length < stored.length ? { recovery_hashes: left } : null;
}

async function recordFailure(admin: AdminContext, c: AppContext, mfa: Row, now: Date): Promise<never> {
  const failures = Number(mfa.failed_count ?? 0) + 1;
  const isLocking = failures >= MAX_FAILURES;
  const patch = isLocking ? { failed_count: 0, locked_until: new Date(now.getTime() + LOCK_MS).toISOString() } : { failed_count: failures };
  await admin.db.table("admin_mfa").update({ user_id: mfa.user_id }, patch);
  await writeAudit(admin, c, "admin.mfa_failed", null, null, { failures });
  throw new ApiError(400, "invalid_code", "That code is not right. Check the time on your phone and try again.");
}

/** Check a code or recovery code against the stored authenticator, with lockout and replay protection. */
export async function checkSecondFactor(
  admin: AdminContext,
  c: AppContext,
  mfa: Row,
  body: SecondFactorBody,
  isPending: boolean,
): Promise<void> {
  const now = admin.deps.now();
  if (mfa.locked_until && Date.parse(str(mfa.locked_until)) > now.getTime()) {
    throw new ApiError(429, "locked", "Too many wrong codes. Try again in 15 minutes.");
  }
  const patch = await matchSecondFactor(admin, mfa, body, isPending, now);
  if (!patch) return recordFailure(admin, c, mfa, now);
  await admin.db.table("admin_mfa").update({ user_id: mfa.user_id }, { ...patch, failed_count: 0, locked_until: null });
}
