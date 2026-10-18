import type { Context } from "hono";
import type { Database, Deps, Row } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import type { KeyLimit } from "../../middleware/rateLimit";
import { profilesRepository } from "../../repositories/profiles";

export const STAFF_DOMAIN = "aevrin.net";
export const PAGE_SIZE = 50;

/** What every admin handler works with. All queries use the server key, behind the staff and session checks. */
export interface AdminContext {
  deps: Deps;
  db: Database;
  limit: KeyLimit;
}

/** A staff email: verified, and exactly on the staff domain (not a subdomain, not a look-alike). */
export function isStaffEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  return atIndex > 0 && normalized.slice(atIndex + 1) === STAFF_DOMAIN;
}

export function totpKey(deps: Deps): string {
  if (!deps.admin?.totpKey) throw new ApiError(503, "admin_unavailable", "The admin console is not configured.");
  return deps.admin.totpKey;
}

/** The profile of the user an admin acts on, or a 404. */
export async function findUser(db: Database, id: string): Promise<Row> {
  const profile = await profilesRepository(db).findById(id);
  if (!profile) throw new ApiError(404, "not_found", "No such user.");
  return profile;
}

/** The zero-based `page` query parameter; anything unreadable is the first page. */
export function pageParam(c: Context): number {
  return Math.max(0, Number(c.req.query("page") ?? 0) || 0);
}
