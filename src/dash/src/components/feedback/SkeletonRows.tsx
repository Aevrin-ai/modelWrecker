import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SkeletonRowsProps {
  rows?: number;
  cols?: number;
}

export function SkeletonRows({ rows = 6, cols = 5 }: SkeletonRowsProps) {
  return (
    <div className="divide-y rounded-md border">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 p-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className={cn("h-4", colIndex === 0 ? "w-40" : "w-20")} />
          ))}
        </div>
      ))}
    </div>
  );
}
