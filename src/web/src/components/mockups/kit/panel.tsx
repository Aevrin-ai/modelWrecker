import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PanelProps {
  title?: ReactNode;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
  label?: string;
}

// the list panel a card holds: a title and a count, then rows
export function Panel({ title, meta, className, children, label }: PanelProps) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "h-full overflow-hidden rounded-xl border border-slate-900/10 bg-slate-50 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100",
        className,
      )}
    >
      <div aria-hidden={label ? true : undefined} className="contents">
        {title && (
          <div className="flex items-baseline gap-3 py-5 pr-14 pl-6 sm:pl-8">
            <span className="text-[18px] font-semibold">{title}</span>
            {meta && <span className="ml-auto text-[14px] text-slate-500 tabular-nums dark:text-slate-400">{meta}</span>}
          </div>
        )}
        <div className="divide-y divide-slate-900/[0.08] border-t border-slate-900/[0.08] dark:divide-white/[0.08] dark:border-white/[0.08]">
          {children}
        </div>
      </div>
    </div>
  );
}
