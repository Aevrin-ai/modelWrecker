import type { Deps } from "../types/deps";
import { ApiError } from "../lib/errors";
import { profilesRepository } from "../repositories/profiles";

/** A suspended account (admin console) cannot use the API or its devices until it is restored. */
export async function refuseSuspended(deps: Deps, ownerId: string): Promise<void> {
  const profile = await profilesRepository(deps.serviceDb).findById(ownerId);
  if (profile?.suspended_at) {
    throw new ApiError(403, "account_suspended", "This account is suspended. Contact Aevrin support.");
  }
}
