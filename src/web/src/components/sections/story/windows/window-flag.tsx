import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DangerTriangle } from "@/components/ui/solar-icons";

export interface WindowFlagProps {
  children: ReactNode;
  tone?: "warn" | "bad";
}

// the one detail that makes a window worth a second look
export function WindowFlag({ children, tone = "warn" }: WindowFlagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap",
        tone === "warn"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
          : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
      )}
    >
      <DangerTriangle className="size-3.5" />
      {children}
    </span>
  );
}
