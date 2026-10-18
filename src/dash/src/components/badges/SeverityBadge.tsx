import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SEVERITY_DOT, SEVERITY_TONE, toneClass } from "@/lib/badges";
import type { Severity } from "@/types";

export interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <Badge tone={toneClass(SEVERITY_TONE[severity])} className={cn("capitalize", className)}>
      <span className={cn("size-1.5 rounded-full", SEVERITY_DOT[severity])} />
      {severity}
    </Badge>
  );
}
