import type { Deps } from "../types/deps";
import { ApiError } from "../lib/errors";

/** A suspended account (admin console) cannot use the API or its devices until it is restored. */
export async function refuseSuspended(deps: Deps, ownerId: string): Promise<void> {
  const [profile] = await deps.serviceDb.table("profiles").select({ eq: { id: ownerId } });
  if (profile?.suspended_at) {
    throw new ApiError(403, "account_suspended", "This account is suspended. Contact Aevrin support.");
  }
}
