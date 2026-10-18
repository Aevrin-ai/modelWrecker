import { motion, useTransform, type MotionValue } from "motion/react";

import type { RingLayout } from "./use-ring-layout";

export interface RingWireProps {
  wire: RingLayout["wires"][number];
  progress: MotionValue<number>;
}

export function RingWire({ wire, progress }: RingWireProps) {
  const [drawStart, drawEnd] = wire.draw;
  const length = useTransform(progress, [drawStart, drawEnd], [0, 1]);
  const startDot = useTransform(progress, [drawStart, drawStart + 0.005], [0, 1]);
  const endDot = useTransform(progress, [drawEnd - 0.005, drawEnd], [0, 1]);
  const [start, end] = wire.ends;
  return (
    <>
      <motion.path
        d={wire.d}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={wire.accent ? "stroke-lime" : "stroke-slate-300 dark:stroke-white/20"}
        style={{ pathLength: length }}
      />
      <motion.circle cx={start[0]} cy={start[1]} r="3" className="fill-slate-900 dark:fill-white" style={{ opacity: startDot }} />
      <motion.circle cx={end[0]} cy={end[1]} r="3" className="fill-slate-900 dark:fill-white" style={{ opacity: endDot }} />
    </>
  );
}
