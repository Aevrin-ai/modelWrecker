import { easeOut, motion, useTransform, type MotionValue } from "motion/react";

import type { Step } from "./steps";
import { PLACES } from "./ring-places";

// every card has the same least width, so mirrored cards match and so do their wires
function NodeCard({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <div className="flex min-w-36 items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 whitespace-nowrap ring-1 ring-slate-900/10 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_6px_16px_-10px_rgba(15,23,42,0.25)] xl:min-w-[10.5rem] dark:bg-slate-900 dark:ring-white/10">
      <Icon aria-hidden="true" className="text-brand size-5 shrink-0" />
      <span className="text-foreground text-[15px] leading-none xl:text-[17px]">{step.label}</span>
    </div>
  );
}

export interface RingNodeProps {
  step: Step;
  show: number;
  progress: MotionValue<number>;
  nodeRef: (node: HTMLDivElement | null) => void;
}

export function RingNode({ step, show, progress, nodeRef }: RingNodeProps) {
  const { at, tilt, enter } = PLACES[step.id];
  const during = [show, show + 0.035];
  const isBlurEntry = enter[0] === "blur";
  const opacity = useTransform(progress, during, [0, 1]);
  const scale = useTransform(progress, during, [enter[0] === "scale" ? enter[1] : 1, 1], { ease: easeOut });
  const y = useTransform(progress, during, [isBlurEntry ? 20 : 0, 0], { ease: easeOut });
  const rotate = useTransform(progress, during, [tilt, 0], { ease: easeOut });
  const filter = useTransform(progress, during, [isBlurEntry ? "blur(4px)" : "blur(0px)", "blur(0px)"]);
  return (
    // a point with no size where the card rests, so it scales about its centre
    <motion.div className="absolute size-0" style={{ left: `${at[0]}%`, top: `${at[1]}%`, opacity, scale, y, rotate, filter }}>
      <div ref={nodeRef} className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
        <NodeCard step={step} />
      </div>
    </motion.div>
  );
}
