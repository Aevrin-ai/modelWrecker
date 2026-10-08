import type { Variants } from "motion/react";

// Shared motion configuration. Entrance + scroll reveals use transform/opacity
// only (GPU-friendly). prefers-reduced-motion is respected by motion's
// `useReducedMotion`, and also globally dampened in index.css.

const easeOutSoft: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutSoft },
  },
};
