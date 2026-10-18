import type { Row } from "../../types/deps";
import { str } from "../../lib/strings";

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A database value as a number; missing or unreadable values become 0. */
export const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);

/** A database timestamp as a string, or null when it is missing. */
export const iso = (value: unknown) => (value == null ? null : String(value));

// "2026-10-02T09:05:00Z" -> "2026-10-02"
export const day = (value: unknown) => str(value).slice(0, 10);

export const emptySeverity = () => ({ critical: 0, high: 0, medium: 0, low: 0, info: 0 }) as Record<string, number>;

export const byId = (rows: Row[]) => new Map(rows.map((row) => [str(row.id), row]));

/** The total of one numeric column over some rows. */
export function sumOf(rows: Row[], column: string): number {
  return rows.reduce((total, row) => total + num(row[column]), 0);
}

/** The latest of some ISO timestamps, or undefined when there are none. */
export function latest(values: string[]): string | undefined {
  return values.sort().pop();
}
