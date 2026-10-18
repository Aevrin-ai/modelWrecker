// Readiness: one cheap database read with a short timeout, so a probe never adds load during an incident.
import type { Database } from "../types/deps";
import { errorFields, log } from "../lib/log";
import { subscriptionsRepository } from "../repositories/subscriptions";

export type CheckResult = "ok" | "unavailable";

const PROBE_TIMEOUT_MS = 3000;

/** Read one row from a small table. Any failure, including a slow answer, is "unavailable". */
export async function checkDatabase(db: Database, timeoutMs = PROBE_TIMEOUT_MS): Promise<CheckResult> {
  try {
    await withTimeout(subscriptionsRepository(db).probe(), timeoutMs);
    return "ok";
  } catch (err) {
    log.warn("readiness_database_failed", errorFields(err));
    return "unavailable";
  }
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}
