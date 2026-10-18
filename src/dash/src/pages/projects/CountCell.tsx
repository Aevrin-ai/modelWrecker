import type { LucideIcon } from "lucide-react";

export interface CountCellProps {
  icon: LucideIcon;
  value: number;
  label: string;
}

export function CountCell({ icon: Icon, value, label }: CountCellProps) {
  return (
    <div className="space-y-0.5">
      <Icon className="mx-auto size-4 text-muted-foreground" />
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}
