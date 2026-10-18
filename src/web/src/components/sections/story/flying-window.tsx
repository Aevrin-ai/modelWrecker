import { easeIn, easeOut, motion, useTransform, type MotionValue } from "motion/react";

import type { WindowSpot } from "./window-spots";

const FLY_IN = 0.14;
const LEAVE = 0.605;
const LEAVE_GAP = 0.009;
const LEAVE_FOR = 0.065;
const linear = (t: number) => t;

export interface FlyingWindowProps {
  win: WindowSpot;
  index: number;
  progress: MotionValue<number>;
  size: number;
}

export function FlyingWindow({ win, index, progress, size }: FlyingWindowProps) {
  const [restX, restY] = win.at;
  const [fromX, fromY, fromTilt] = win.from;
  const flyInStart = win.start;
  const flyInEnd = flyInStart + FLY_IN;
  const leaveStart = LEAVE + index * LEAVE_GAP;
  const leaveEnd = leaveStart + LEAVE_FOR;
  const steps = [flyInStart, flyInEnd, leaveStart, leaveEnd];
  const ease = [easeOut, linear, easeIn];

  // in from off screen, rest, then drawn into the middle of the stage
  const x = useTransform(progress, steps, [`${fromX}vw`, "0vw", "0vw", `${50 - restX}vw`], { ease });
  const y = useTransform(progress, steps, [`${fromY}vh`, "0vh", "0vh", `${50 - restY}vh`], { ease });
  const rotate = useTransform(progress, steps, [fromTilt, win.tilt, win.tilt, 0], { ease });
  const scale = useTransform(progress, [leaveStart, leaveEnd], [size, size * 0.05], { ease: easeIn });
  const opacity = useTransform(progress, [flyInStart, flyInStart + 0.004, leaveStart, leaveEnd - 0.01], [0, 1, 1, 0]);

  const { Comp } = win;
  return (
    // a point with no size at the resting place, so the window scales and tilts about its own centre
    <motion.div
      className="absolute size-0 will-change-transform"
      style={{ left: `${restX}%`, top: `${restY}%`, x, y, rotate, scale, opacity, zIndex: win.front ? 35 : 33 }}
    >
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
        <Comp />
      </div>
    </motion.div>
  );
}
