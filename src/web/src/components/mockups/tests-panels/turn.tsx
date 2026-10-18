import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Spinner } from "../kit";
import { EASE } from "../tokens";

// swaps a spinner for its answer once `ready`
function Settle({ ready, children }: { ready: boolean; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={ready ? "ready" : "wait"}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: EASE }}
        className="flex shrink-0 items-center"
      >
        {ready ? children : <Spinner />}
      </motion.span>
    </AnimatePresence>
  );
}

export interface TurnProps {
  phase: number;
  index: number;
  children: ReactNode;
}

// the right side of a row that runs in turn: nothing yet, a spinner on its turn, then the answer
export function Turn({ phase, index, children }: TurnProps) {
  if (phase < index) return null;
  return <Settle ready={phase > index}>{children}</Settle>;
}
