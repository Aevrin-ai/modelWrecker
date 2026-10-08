// Usage meters for one account (docs/security/entitlements.md). Campaign runs and attack attempts count
// per calendar month (UTC); devices and projects count what exists now.
import type { Db } from "./db";
import { meterPeriod, type MeterKey } from "./plans";

interface Usage {
  period: string;
  periodStart: string;
  periodEnd: string;
  values: Record<MeterKey, number>;
}

export async function usageFor(db: Db, owner: string, now: Date): Promise<Usage> {
  const { start, end, key } = meterPeriod(now);
  const [runs, devices, projects] = await Promise.all([
    db.table("runs").select({ eq: { owner_id: owner }, gte: { created_at: start.toISOString() } }),
    db.table("devices").select({ eq: { owner_id: owner } }),
    db.table("projects").select({ eq: { owner_id: owner } }),
  ]);
  return {
    period: key,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    values: {
      campaigns: runs.length,
      attacks: runs.reduce((a, r) => a + (Number(r.attempts) || 0), 0),
      devices: devices.filter((d) => !d.revoked).length,
      projects: projects.filter((p) => !p.archived).length,
    },
  };
}
