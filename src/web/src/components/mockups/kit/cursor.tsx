import { motion, useReducedMotion } from "motion/react";

import { EASE } from "../tokens";

export interface CursorProps {
  x: number;
  y: number;
  pressed?: boolean;
  visible?: boolean;
}

// decorative pointer placed in percent of the mockup, so it lands right at any size; not drawn for reduced motion
export function Cursor({ x, y, pressed = false, visible = true }: CursorProps) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-30"
      initial={false}
      animate={{ left: `${x}%`, top: `${y}%`, opacity: visible ? 1 : 0, scale: pressed ? 0.85 : 1 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]">
        <path d="M5 3.5 19 12l-6.6 1.7L9 20.5z" fill="#020617" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}
