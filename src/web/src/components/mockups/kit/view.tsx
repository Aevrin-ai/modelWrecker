import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { EASE } from "../tokens";

export interface ViewProps {
  show: boolean;
  className?: string;
  children: ReactNode;
}

// views that take turns share one cell of a `grid` parent, so the card keeps the tallest height and never jumps
export function View({ show, className, children }: ViewProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("col-start-1 row-start-1 min-w-0", !show && "pointer-events-none", className)}
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
