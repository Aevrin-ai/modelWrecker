// Typed failures, and the one place a thrown value becomes a safe response.
import { ZodError } from "zod";

export type ApiStatus = 400 | 401 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500 | 502 | 503;

/** An error that is safe to show the caller. Anything else becomes a generic 500. */
export class ApiError extends Error {
  constructor(
    public status: ApiStatus,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** A database failure. `code` is the Postgres SQLSTATE or PostgREST code; the message goes to logs only. */
export class DbError extends Error {
  /** The repository query that failed, such as `profiles.findById`, set by `namedQueries`. */
  operation?: string;

  constructor(
    message: string,
    public code = "",
  ) {
    super(message);
    this.name = "DbError";
  }
}

// codes meaning "the database cannot answer right now"; a bad query or a broken constraint never counts
const UNAVAILABLE_CODES = new Set([
  "PGRST000", // PostgREST could not connect to the database
  "PGRST001", // the database connection was lost
  "PGRST002", // the schema cache could not be loaded
  "53300", // too_many_connections
  "57014", // query_canceled, which includes a statement timeout
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "40001", // serialization_failure
  "40P01", // deadlock_detected
]);

/** True when a database error means "try again later" rather than "this request is wrong". */
export function isDbUnavailable(err: DbError): boolean {
  // an empty code means no answer came back at all: a network failure or our own timeout
  if (err.code === "") return true;
  // class 08 is every Postgres connection exception
  return UNAVAILABLE_CODES.has(err.code) || err.code.startsWith("08");
}

export interface Failure {
  status: ApiStatus;
  code: string;
  message: string;
  /** True when the failure was not anticipated, so it must be logged with diagnostics. */
  unexpected: boolean;
}

export const UNAVAILABLE_MESSAGE = "The service is busy right now. Try again in a moment.";
export const INTERNAL_MESSAGE =
  "The server hit an unexpected error. Try again, and contact support with the reference id if it keeps happening.";

/** Turn any thrown value into the status, code, and safe message the caller receives. */
export function classifyError(err: unknown): Failure {
  if (err instanceof ApiError) return { status: err.status, code: err.code, message: err.message, unexpected: false };
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const where = issue?.path.join(".") || "body";
    return { status: 422, code: "invalid_request", message: `${where}: ${issue?.message ?? "invalid"}`, unexpected: false };
  }
  if (err instanceof DbError && isDbUnavailable(err)) {
    return { status: 503, code: "service_unavailable", message: UNAVAILABLE_MESSAGE, unexpected: true };
  }
  return { status: 500, code: "internal", message: INTERNAL_MESSAGE, unexpected: true };
}
