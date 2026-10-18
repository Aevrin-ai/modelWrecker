// usage meters: runs and attempts count per calendar month (UTC); devices and projects count what exists now
import type { Database } from "../../types/deps";
import { meterPeriod, type MeterKey } from "../billing/plans";
import { ownedRowsRepository } from "../../repositories/ownedRows";
import { runsRepository } from "../../repositories/runs";

interface Usage {
  period: string;
  periodStart: string;
  periodEnd: string;
  values: Record<MeterKey, number>;
}

export async function usageFor(db: Database, owner: string, now: Date): Promise<Usage> {
  const { start, end, key } = meterPeriod(now);
  const [runs, devices, projects] = await Promise.all([
    runsRepository(db).listSinceForOwner(owner, start.toISOString()),
    ownedRowsRepository(db, "devices").listForOwner(owner),
    ownedRowsRepository(db, "projects").listForOwner(owner),
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
