import { Badge } from "@/components/ui/badge";
import { CONFIDENCE_LABEL, CONFIDENCE_TONE, toneClass } from "@/lib/badges";
import type { ConfidenceLevel } from "@/types";

export interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
}

export function ConfidenceBadge({ level }: ConfidenceBadgeProps) {
  return <Badge tone={toneClass(CONFIDENCE_TONE[level])}>{CONFIDENCE_LABEL[level]}</Badge>;
}
