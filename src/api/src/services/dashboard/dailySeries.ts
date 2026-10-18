import { str } from "../../lib/strings";
import { day, num } from "./rows";
import type { World } from "./world";

interface DayBucket {
  attempts: number;
  successes: number;
  runs: number;
  campaigns: Set<string>;
  findings: number;
}

function bucketsByDay(world: World): Map<string, DayBucket> {
  const perDay = new Map<string, DayBucket>();
  const bucketFor = (date: string): DayBucket => {
    const existing = perDay.get(date);
    if (existing) return existing;
    const created: DayBucket = { attempts: 0, successes: 0, runs: 0, campaigns: new Set(), findings: 0 };
    perDay.set(date, created);
    return created;
  };
  for (const run of world.runs) {
    const bucket = bucketFor(day(run.completed_at ?? run.created_at));
    bucket.attempts += num(run.attempts);
    bucket.successes += num(run.successful_attacks);
    bucket.runs += 1;
    bucket.campaigns.add(str(run.campaign_id));
  }
  for (const finding of world.findings) bucketFor(day(finding.discovered_at ?? finding.created_at)).findings += 1;
  return perDay;
}

/** The Analytics page's trend lines, one point per day with activity, oldest first. */
export function dailySeries(world: World) {
  // days without a timestamp land under "" and are left out
  const days = [...bucketsByDay(world).entries()]
    .filter(([date]) => date !== "")
    .sort(([first], [second]) => (first < second ? -1 : 1));
  return {
    successRateOverTime: days.map(([date, bucket]) => ({
      date,
      value: bucket.attempts ? bucket.successes / bucket.attempts : 0,
    })),
    findingsOverTime: days.map(([date, bucket]) => ({ date, value: bucket.findings })),
    campaignActivity: days.map(([date, bucket]) => ({
      date,
      campaigns: bucket.campaigns.size,
      runs: bucket.runs,
      successfulAttacks: bucket.successes,
    })),
  };
}
