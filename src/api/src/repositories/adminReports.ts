import type { Database } from "../types/deps";
import { namedQueries } from "../database/namedQueries";

interface UserListQuery {
  query: string;
  plan: string;
  limit: number;
  offset: number;
}

// the admin console's aggregates, computed by Postgres functions (deploy/supabase/migrations)
export function adminReportsRepository(db: Database) {
  return namedQueries("adminReports", {
    userList: ({ query, plan, limit, offset }: UserListQuery): Promise<unknown> =>
      db.rpc("admin_user_list", { p_query: query, p_plan: plan, p_limit: limit, p_offset: offset }),
    metrics: (days: number): Promise<unknown> => db.rpc("admin_metrics", { p_days: days }),
    traffic: (days: number, site: string): Promise<unknown> => db.rpc("admin_traffic", { p_days: days, p_site: site }),
  });
}
