import { Badge } from "@/components/ui/badge";
import { TARGET_TYPE_LABEL } from "@/lib/constants";
import type { TargetType } from "@/types";

export interface TargetTypeBadgeProps {
  type: TargetType;
}

export function TargetTypeBadge({ type }: TargetTypeBadgeProps) {
  return (
    <Badge tone="bg-secondary text-secondary-foreground" className="font-mono uppercase">
      {TARGET_TYPE_LABEL[type]}
    </Badge>
  );
}
