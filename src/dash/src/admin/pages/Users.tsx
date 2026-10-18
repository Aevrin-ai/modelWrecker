import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Users as UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataState, EmptyState, SkeletonRows } from "@/components/States";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatNumber, relativeTime } from "@/lib/format";
import { formatPaise } from "@/lib/plans";
import { adminClient } from "../client";
import type { AdminUserRow } from "../client";
import { PlanBadge } from "./shared";

function paidUntilText(row: AdminUserRow): string {
  if (row.effective_plan === "free") return "-";
  if (row.current_period_end) return formatDate(row.current_period_end);
  return "No end";
}

export function Users() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const plan = params.get("plan") ?? "";
  const page = Number(params.get("page") ?? 0) || 0;
  const [draft, setDraft] = useState(query);
  const users = useAsync(() => adminClient.users(query, plan, page), [query, plan, page]);

  useEffect(() => setDraft(query), [query]);

  const updateParams = (next: Record<string, string>) => {
    const nextParams = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    }
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Every account, its plan, and its activity. Open one to change its plan, credit, devices, or settings." />
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative min-w-[16rem] flex-1 sm:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: draft.trim(), page: "" });
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search email, name, or user id" className="pl-8" aria-label="Search users" />
        </form>
        <Select value={plan} onChange={(e) => updateParams({ plan: e.target.value, page: "" })} aria-label="Filter by plan">
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <DataState
            loading={users.loading}
            error={users.error}
            data={users.data?.users}
            onRetry={users.refetch}
            skeleton={<SkeletonRows rows={8} cols={7} />}
            empty={<EmptyState icon={UsersIcon} title="No users found" description="Try another search or filter." />}
          >
            {(rows) => (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Paid until</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Devices</TableHead>
                      <TableHead className="text-right">Runs this month</TableHead>
                      <TableHead>Last active</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <Link to={`/users/${u.id}`} className="font-medium hover:underline">
                            {u.email}
                          </Link>
                          <p className="text-xs text-muted-foreground">{u.display_name}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <PlanBadge plan={u.effective_plan} />
                            {u.suspended_at && <Badge tone="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200">Suspended</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{paidUntilText(u)}</TableCell>
                        <TableCell className="text-right tabular-nums">{u.credit_paise ? formatPaise(u.credit_paise) : "-"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(u.devices)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(u.runs_month)}</TableCell>
                        <TableCell className="text-muted-foreground">{u.last_active ? relativeTime(u.last_active) : "Never"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(u.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DataState>
        </CardContent>
      </Card>
      {users.data && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {formatNumber(users.data.total)} user{users.data.total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => updateParams({ page: String(page - 1) })}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * users.data.pageSize >= users.data.total} onClick={() => updateParams({ page: String(page + 1) })}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
