import { cn } from "@/lib/utils";

interface ProgressProps {
  /** 0..1 fraction. */
  value: number;
  className?: string;
  indicatorClassName?: string;
}

/** A thin Catmint-style progress track. */
export function Progress({ value, className, indicatorClassName }: ProgressProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-all", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
