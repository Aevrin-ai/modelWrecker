import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, humanize, relativeTime } from "@/lib/format";
import type { UserDetail as Detail } from "../../client";
import { PlanBadge } from "../PlanBadge";

export interface UserHeaderProps {
  user: Detail;
  onRename: () => void;
}

export function UserHeader({ user, onRename }: UserHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {user.email}
          <PlanBadge plan={user.subscription.effectivePlan} />
          {user.suspendedAt && <Badge tone="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">Suspended</Badge>}
          {user.isStaff && <Badge tone="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">Staff</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.name || "No name"} . Joined {formatDate(user.createdAt)} . Last sign-in {user.account?.lastSignInAt ? relativeTime(user.account.lastSignInAt) : "unknown"}
          {user.account?.providers.length ? ` . ${user.account.providers.map(humanize).join(", ")}` : ""}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{user.id}</p>
        {user.suspendedAt && (
          <p className="text-sm text-destructive">
            Suspended {formatDateTime(user.suspendedAt)}
            {user.suspendedReason ? `: ${user.suspendedReason}` : ""}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onRename}>
        <Pencil /> Rename
      </Button>
    </div>
  );
}
