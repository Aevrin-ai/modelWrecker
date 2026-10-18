import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge, TargetStatusBadge, TargetTypeBadge } from "@/components/StatusBadges";
import type { Target } from "@/types";

export interface TargetCardListProps {
  targets: Target[];
}

export function TargetCardList({ targets }: TargetCardListProps) {
  return (
      <div className="space-y-3 md:hidden">
        {targets.map((target) => (
          <Card key={target.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{target.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{target.model}</p>
              </div>
              <TargetTypeBadge type={target.type} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TargetStatusBadge status={target.status} />
              {target.authorized ? (
                <Badge tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Authorized
                </Badge>
              ) : (
                <Badge tone="bg-secondary text-secondary-foreground">Not authorized</Badge>
              )}
              {target.topSeverity && <SeverityBadge severity={target.topSeverity} />}
            </div>
          </Card>
        ))}
      </div>
  );
}
