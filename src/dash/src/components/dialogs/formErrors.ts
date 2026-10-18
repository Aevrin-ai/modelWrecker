import type { ZodIssue } from "zod";

// an API failure is always an Error with a safe message; anything else means the request never finished
export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "The change did not reach the server. Check your connection and try again.";
}

// [{ path: ["name"], message: "Too short" }] -> { name: "Too short" }
export function fieldErrors(issues: ZodIssue[]): Record<string, string> {
  return Object.fromEntries(issues.map((issue) => [String(issue.path[0]), issue.message]));
}
