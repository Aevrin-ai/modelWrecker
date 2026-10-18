import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { UserDetail as Detail } from "../../client";
import { actionLabel, detailSummary } from "../auditText";

export interface AuditCardProps {
  user: Detail;
}

export function AuditCard({ user }: AuditCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>Admin changes to this account.</CardDescription>
      </CardHeader>
      <CardContent>
        {user.audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin changes yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {user.audit.map((entry) => (
              <li key={entry.id} className="border-l-2 pl-3">
                <p>
                  <span className="font-medium">{actionLabel(entry.action)}</span> by {entry.adminEmail} . {formatDateTime(entry.createdAt)}
                </p>
                {entry.reason && <p className="text-muted-foreground">"{entry.reason}"</p>}
                {Object.keys(entry.detail).length > 0 && <p className="font-mono text-xs text-muted-foreground">{detailSummary(entry.detail)}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
