import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface AppCardProps {
  className?: string;
  children: ReactNode;
  label?: string;
}

// a floating app window; with a label it is one picture (role="img") whose insides screen readers skip
export function AppCard({ className, children, label }: AppCardProps) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-white text-slate-900 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10",
        "shadow-float",
        className,
      )}
    >
      <div aria-hidden={label ? true : undefined} className="contents">
        {children}
      </div>
    </div>
  );
}
