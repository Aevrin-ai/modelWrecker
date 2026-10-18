import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { EASE } from "../tokens";

export interface AppearProps {
  show: boolean;
  delay?: number;
  className?: string;
  children: ReactNode;
  y?: number;
}

// fades and rises into place whenever `show` turns true
export function Appear({ show, delay = 0, className, children, y = 8 }: AppearProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={reduce ? { duration: 0 } : { duration: 0.45, delay: show ? delay : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
