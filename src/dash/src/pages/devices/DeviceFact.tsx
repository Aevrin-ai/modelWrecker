import { cn } from "@/lib/utils";

export interface DeviceFactProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function DeviceFact({ label, value, mono }: DeviceFactProps) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-right font-medium", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}
