import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/ui/solar-icons";
import { Tile } from "./tile";

export interface RowProps {
  icon?: IconComponent;
  tile?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
  highlight?: boolean;
}

export function Row({ icon, tile, title, sub, right, className, highlight }: RowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 py-4 pr-14 pl-6 transition-colors duration-500 sm:pl-8",
        highlight && "bg-slate-900/[0.04] dark:bg-white/[0.06]",
        className,
      )}
    >
      {tile ?? (icon && <Tile icon={icon} />)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px]">{title}</span>
        {sub && <span className="block truncate text-[14px] text-slate-600 dark:text-slate-400">{sub}</span>}
      </span>
      {right}
    </div>
  );
}
