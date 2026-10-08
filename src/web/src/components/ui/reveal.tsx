import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { EASE } from "@/components/mockups/tokens";

const TAGS = { div: motion.div, li: motion.li, article: motion.article, section: motion.section } as const;

// Rises and fades in the first time it scrolls into view. Still for anyone
// who has asked for less motion.
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  as = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: keyof typeof TAGS;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const Comp = TAGS[as];
  return (
    <Comp
      id={id}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}
