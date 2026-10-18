import type { AppContext } from "../../types/appEnv";
import type { Database, Deps } from "../../types/deps";
import { ApiError } from "../../lib/errors";
import { effectivePlan } from "../../services/billing/plans";
import { ownedRowsRepository, type OwnedTable } from "../../repositories/ownedRows";
import { subscriptionsRepository } from "../../repositories/subscriptions";

/** What every dashboard handler works with: the user's RLS-scoped database and their verified id. */
export interface UserScope {
  db: Database;
  owner: string;
  now: Date;
}

// every dashboard route runs behind requireUser; the owner is always the verified user, never input
export function userScope(c: AppContext, deps: Deps): UserScope {
  return { db: c.get("db"), owner: c.get("user").id, now: deps.now() };
}

/** A query parameter, or undefined when it is missing or empty. */
export function queryParam(c: AppContext, key: string): string | undefined {
  return c.req.query(key) || undefined;
}

// read with the server key: a user can read but never write their subscription
export async function planFor(deps: Deps, owner: string, now: Date) {
  const subscription = await subscriptionsRepository(deps.serviceDb).findForOwner(owner);
  return effectivePlan(subscription, now);
}

export const NOT_FOUND_MESSAGE = "Not found, or you do not have access to it.";

/** One row the user owns, or a 404 that does not say whether it exists. */
export async function findOwned(db: Database, table: OwnedTable, id: string, owner: string) {
  const row = await ownedRowsRepository(db, table).findForOwner(id, owner);
  if (!row) throw new ApiError(404, "not_found", NOT_FOUND_MESSAGE);
  return row;
}
