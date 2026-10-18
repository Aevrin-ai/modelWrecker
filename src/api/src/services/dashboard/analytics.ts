import type { Row } from "../../types/deps";
import { wilson } from "../../lib/wilson";
import { str } from "../../lib/strings";
import { dailySeries } from "./dailySeries";
import { leaderboard } from "./leaderboard";
import { emptySeverity, num, sumOf } from "./rows";
import type { World } from "./world";

interface StrategyCount {
  strategy: string;
  attempts: number;
  successes: number;
}

function severityBreakdown(findings: Row[]): Record<string, number> {
  const severity = emptySeverity();
  for (const finding of findings) severity[str(finding.severity)] = (severity[str(finding.severity)] ?? 0) + 1;
  return severity;
}

function strategyRates(runs: Row[]) {
  const strategies = new Map<string, { attempts: number; successes: number }>();
  for (const run of runs) {
    for (const entry of (run.by_strategy as StrategyCount[] | null) ?? []) {
      const total = strategies.get(entry.strategy) ?? { attempts: 0, successes: 0 };
      total.attempts += num(entry.attempts);
      total.successes += num(entry.successes);
      strategies.set(entry.strategy, total);
    }
  }
  return [...strategies.entries()].map(([strategy, total]) => ({
    strategy,
    attempts: total.attempts,
    asr: total.attempts ? total.successes / total.attempts : 0,
  }));
}

function taxonomyCounts(findings: Row[]) {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    for (const key of str(finding.taxonomy).split(",").filter(Boolean)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => {
    const [framework, ...rest] = key.split(":");
    return { framework, id: rest.join(":"), title: "", count };
  });
}

/** The Analytics page: attack success, breakdowns, trends, and the model leaderboard. */
export function analytics(world: World) {
  const attempts = sumOf(world.runs, "attempts");
  const successes = sumOf(world.runs, "successful_attacks");
  const [ciLow, ciHigh] = wilson(successes, attempts);
  return {
    asr: attempts ? successes / attempts : 0,
    asrCiLow: ciLow,
    asrCiHigh: ciHigh,
    robustness: attempts ? 1 - successes / attempts : 0,
    totalAttempts: attempts,
    totalFindings: world.findings.length,
    severityBreakdown: severityBreakdown(world.findings),
    byStrategy: strategyRates(world.runs),
    // objective categories are not part of the synced metadata yet, so this stays empty
    byCategory: [],
    byTaxonomy: taxonomyCounts(world.findings),
    ...dailySeries(world),
    leaderboard: leaderboard(world),
  };
}
