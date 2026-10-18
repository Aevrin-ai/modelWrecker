import { HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RunsLocallyChipProps {
  className?: string;
}

export function RunsLocallyChip({ className }: RunsLocallyChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <HardDrive className="size-3.5" />
      Runs on your local engine
    </span>
  );
}
