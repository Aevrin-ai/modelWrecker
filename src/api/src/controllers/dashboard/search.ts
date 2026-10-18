import type { AppContext } from "../../types/appEnv";
import type { Deps } from "../../types/deps";
import { userScope } from "./context";
import { RESULTS_PER_KIND, searchResults } from "../../services/dashboard/search";

const MAX_TERM_CHARS = 80;
const MIN_TERM_CHARS = 2;

export async function search(c: AppContext, deps: Deps): Promise<Response> {
  const { db, owner } = userScope(c, deps);
  const term = (c.req.query("q") ?? "").trim().slice(0, MAX_TERM_CHARS);
  if (term.length < MIN_TERM_CHARS) return c.json([]);
  const find = (table: string, column: string) =>
    db.table(table).select({ eq: { owner_id: owner }, ilike: { column, value: term }, limit: RESULTS_PER_KIND });
  const [projects, targets, campaigns, findings, devices] = await Promise.all([
    find("projects", "name"),
    find("targets", "name"),
    find("campaigns", "name"),
    find("findings", "title"),
    find("devices", "name"),
  ]);
  return c.json(searchResults(projects, targets, campaigns, findings, devices));
}
