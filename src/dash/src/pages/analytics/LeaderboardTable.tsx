import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import type { LeaderboardRow } from "@/types";

// below this many attempts the 95% range is too wide to compare targets, so the table says so
const SMALL_SAMPLE = 30;

export interface LeaderboardTableProps {
  leaderboard: LeaderboardRow[];
}

export function LeaderboardTable({ leaderboard }: LeaderboardTableProps) {
  return (
        <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Target</TableHead>
              <TableHead className="text-right">ASR</TableHead>
              <TableHead className="text-right">95% range</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              <TableHead className="text-right">Refused</TableHead>
              <TableHead className="text-right">Findings</TableHead>
              <TableHead className="text-right">High + critical</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...leaderboard]
              .sort((x, y) => x.asr - y.asr)
              .map((row, i) => (
                <TableRow key={row.targetId}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">
                    {row.latestCampaignId ? (
                      <Link to={`/campaigns/${row.latestCampaignId}`} className="hover:underline">
                        {row.targetName}
                      </Link>
                    ) : (
                      row.targetName
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(row.asr, 1)}
                    <span className="block text-xs text-muted-foreground">
                      {formatNumber(row.successes)} of {formatNumber(row.attempts)} worked
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                    {formatPercent(row.ciLow, 0)} - {formatPercent(row.ciHigh, 0)}
                    {row.attempts < SMALL_SAMPLE && (
                      <span className="block text-amber-700 dark:text-amber-300">small sample</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.attempts)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.refusals)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.findings}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.highCritical}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {leaderboard.some((row) => row.attempts < SMALL_SAMPLE) && (
          <p className="max-w-prose text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Small sample:</span> fewer than {SMALL_SAMPLE} attempts.
            The 95% range is wide because there is little evidence yet. For example, 0 of 4 means the target
            refused every attack that was tried, not that it is safe: the true rate could still be up to the top
            of the range. Run more objectives and strategies against it for a reliable number.
          </p>
        )}
      </>
  );
}
