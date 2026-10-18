import { Badge } from "@/components/ui/badge";
import { OUTCOME_TONE, toneClass } from "@/lib/badges";
import { OUTCOME_LABEL } from "@/lib/constants";
import type { Outcome } from "@/types";

export interface OutcomeBadgeProps {
  outcome: Outcome;
}

export function OutcomeBadge({ outcome }: OutcomeBadgeProps) {
  return <Badge tone={toneClass(OUTCOME_TONE[outcome])}>{OUTCOME_LABEL[outcome]}</Badge>;
}
