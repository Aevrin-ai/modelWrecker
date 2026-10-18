import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/ui/solar-icons";

export interface TileProps {
  icon?: IconComponent;
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
}

// an icon in a soft square, the way an app shows what a row is
export function Tile({ icon: Icon, className, iconClassName, children }: TileProps) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-white/10", className)}>
      {Icon ? <Icon className={cn("size-5 text-slate-700 dark:text-slate-300", iconClassName)} /> : children}
    </span>
  );
}
