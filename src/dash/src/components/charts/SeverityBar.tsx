import { SEVERITY_HEX } from "@/lib/badges";
import { SEVERITY_ORDER } from "@/lib/constants";
import type { Severity } from "@/types";

export interface SeverityBarProps {
  breakdown: Record<Severity, number>;
}

// a thin stacked severity bar for compact cards
export function SeverityBar({ breakdown }: SeverityBarProps) {
  const total = SEVERITY_ORDER.reduce((sum, severity) => sum + breakdown[severity], 0);
  if (total === 0) return <div className="h-2 w-full rounded-full bg-muted" />;
  return (
    <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-muted">
      {SEVERITY_ORDER.map((s) =>
        breakdown[s] > 0 ? (
          <div
            key={s}
            style={{ width: `${(breakdown[s] / total) * 100}%`, background: SEVERITY_HEX[s] }}
            title={`${breakdown[s]} ${s}`}
          />
        ) : null,
      )}
    </div>
  );
}
