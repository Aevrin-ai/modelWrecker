// One redacted JSON line per event; values are flat so a whole object is never logged.

export type LogValue = string | number | boolean | null | undefined;
export type LogFields = Record<string, LogValue>;
type Level = "info" | "warn" | "error";

const MAX_VALUE_CHARS = 1000;

const REDACTIONS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/\bmwd_[A-Za-z0-9_-]+/g, "mwd_[redacted]"],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt redacted]"],
  [/\b(sk|sbp|rzp_live|rzp_test)_[A-Za-z0-9]{8,}/g, "[key redacted]"],
  [/\bsk-[A-Za-z0-9_-]{16,}/g, "[key redacted]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email redacted]"],
];

/** Remove tokens, keys, and email addresses from free text, and cap its length. */
export function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out.length > MAX_VALUE_CHARS ? `${out.slice(0, MAX_VALUE_CHARS)}...` : out;
}

/** The name and message of a thrown value, as log fields. Never the value itself. */
export function errorFields(err: unknown): LogFields {
  if (err instanceof Error) return { errorName: err.name, errorMessage: err.message };
  return { errorMessage: String(err) };
}

function write(level: Level, event: string, fields: LogFields = {}): void {
  const line: LogFields = { level, event };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    line[key] = typeof value === "string" ? redact(value) : value;
  }
  const text = JSON.stringify(line);
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export const log = {
  info: (event: string, fields?: LogFields) => write("info", event, fields),
  warn: (event: string, fields?: LogFields) => write("warn", event, fields),
  error: (event: string, fields?: LogFields) => write("error", event, fields),
};
