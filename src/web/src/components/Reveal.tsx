import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { fadeUp } from "../lib/motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
  as?: "div" | "section" | "li" | "span";
  amount?: number;
};

// Scroll-triggered entrance. Falls back to a static, fully-visible element when
// the viewer prefers reduced motion.
export function Reveal({
  children,
  className,
  variants = fadeUp,
  delay = 0,
  as = "div",
  amount = 0.25,
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      transition={{ delay }}
    >
      {children}
    </MotionTag>
  );
}
