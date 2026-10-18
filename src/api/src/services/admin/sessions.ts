import type { AppContext } from "../../types/appEnv";
import { randomToken, sha256Hex } from "../../lib/tokens";
import { clientIp } from "../../middleware/rateLimit";
import type { AdminContext } from "../../controllers/admin/context";
import { ADMIN_TOKEN_PREFIX } from "../../middleware/adminGuards";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
// consonants and digits that cannot be mistaken for each other when read aloud or typed
const RECOVERY_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ23456789";

// "BCDFG-HJKLM": ten random characters in two groups of five
export function recoveryCode(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

/** Start an admin session; the token is returned once and only its hash is stored. */
export async function startSession(admin: AdminContext, c: AppContext) {
  const token = `${ADMIN_TOKEN_PREFIX}${randomToken(32)}`;
  const now = admin.deps.now();
  const expires = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await admin.db.table("admin_sessions").insert({
    user_id: c.get("user").id,
    token_hash: await sha256Hex(token),
    ip: clientIp(c),
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: expires,
  });
  return { sessionToken: token, expiresAt: expires };
}
