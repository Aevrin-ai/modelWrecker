import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/types";
import { LeaderboardTable } from "./LeaderboardTable";

export interface LeaderboardCardProps {
  summary: AnalyticsSummary;
}

export function LeaderboardCard({ summary }: LeaderboardCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Target leaderboard</CardTitle>
        <CardDescription>
          Most robust first. Attack success rate (ASR) is the share of attacks that worked; lower means a
          harder target. Open a target to read every prompt and reply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        {summary.leaderboardLocked ? (
          <p className="text-sm text-muted-foreground">
            The model leaderboard is part of Pro. Every other chart on this page stays on your plan.{" "}
            <Link to="/billing" className="font-medium text-foreground underline underline-offset-4">
              See plans
            </Link>
          </p>
        ) : (
          <LeaderboardTable leaderboard={summary.leaderboard} />
        )}
      </CardContent>
    </Card>
  );
}
