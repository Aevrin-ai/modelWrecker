import { DbError } from "../lib/errors";

type Query = (...args: never[]) => Promise<unknown>;

/** Wrap each query of a repository so a database failure names it in the logs, such as `profiles.findById`. */
export function namedQueries<Queries extends Record<string, Query>>(repository: string, queries: Queries): Queries {
  const named: Record<string, Query> = {};
  for (const [name, query] of Object.entries(queries)) {
    named[name] = async (...args) => {
      try {
        return await query(...args);
      } catch (err) {
        // the innermost name wins when one repository query calls another
        if (err instanceof DbError) err.operation ??= `${repository}.${name}`;
        throw err;
      }
    };
  }
  return named as Queries;
}
