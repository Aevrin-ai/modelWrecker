import { motion, useReducedMotion } from "motion/react";

import { EASE } from "./tokens";

export interface MachineWireProps {
  on: boolean;
  moving: boolean;
}

// the link between two parts of the machine: grey, lime once used, with a packet running down it while traffic moves
export function MachineWire({ on, moving }: MachineWireProps) {
  const reduce = useReducedMotion();
  return (
    <div className="relative ml-[31px] h-6 w-0.5 bg-slate-200 dark:bg-white/15">
      <motion.span
        className="bg-lime absolute inset-0 origin-top"
        initial={false}
        animate={{ scaleY: on ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
      />
      {moving && !reduce && (
        <motion.span
          className="bg-lime absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full ring-2 ring-white dark:ring-slate-900"
          initial={{ top: "-20%" }}
          animate={{ top: "90%" }}
          transition={{ duration: 0.7, ease: "easeInOut", repeat: Infinity }}
        />
      )}
    </div>
  );
}
