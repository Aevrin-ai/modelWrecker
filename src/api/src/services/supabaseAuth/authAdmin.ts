import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthAccount, AuthAdmin } from "../../types/deps";
import { DbError } from "../../lib/errors";

// about 100 years, which Supabase treats as a ban until it is lifted with "none"
const BAN_DURATION = "876000h";

/** An Auth admin failure: no answer or a 5xx is "unavailable"; a 4xx is a rejected request, kept as a 500. */
function authAdminError(error: { message: string; status?: number }): DbError {
  const isUnavailable = !error.status || error.status >= 500;
  return new DbError(error.message, isUnavailable ? "" : `auth_${error.status}`);
}

/** Supabase Auth admin calls, with the server key. Used only behind the admin console's checks. */
export function supabaseAuthAdmin(service: SupabaseClient): AuthAdmin {
  return {
    async getUser(id: string): Promise<AuthAccount | null> {
      const { data, error } = await service.auth.admin.getUserById(id);
      if (error || !data.user) return null;
      const account = data.user as typeof data.user & { banned_until?: string | null };
      return {
        id: account.id,
        email: account.email ?? null,
        createdAt: account.created_at ?? null,
        lastSignInAt: account.last_sign_in_at ?? null,
        bannedUntil: account.banned_until ?? null,
        providers: (account.identities ?? []).map((identity) => identity.provider),
      };
    },
    async setBanned(id: string, banned: boolean) {
      const { error } = await service.auth.admin.updateUserById(id, { ban_duration: banned ? BAN_DURATION : "none" });
      if (error) throw authAdminError(error);
    },
    async deleteUser(id: string) {
      const { error } = await service.auth.admin.deleteUser(id);
      if (error) throw authAdminError(error);
    },
  };
}
