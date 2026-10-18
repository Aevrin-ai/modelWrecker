import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckItemProps {
  children: ReactNode;
  className?: string;
}

// one line of a ticked list
export function CheckItem({ children, className }: CheckItemProps) {
  return (
    <li className={cn("text-foreground flex items-start gap-2.5 text-[15px] leading-snug", className)}>
      <span className="bg-lime mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-slate-950">
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      </span>
      {children}
    </li>
  );
}
