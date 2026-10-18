import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/ui/solar-icons";

export interface WindowTabProps {
  active: boolean;
  icon: IconComponent;
  children: ReactNode;
}

export function WindowTab({ active, icon: Icon, children }: WindowTabProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors duration-300",
        active
          ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/10 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10"
          : "text-slate-500 dark:text-slate-400",
      )}
    >
      <Icon className="hidden size-4 shrink-0 sm:block" />
      {children}
    </span>
  );
}
