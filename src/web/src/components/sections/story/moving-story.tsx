import { useRef, type ReactNode } from "react";
import { easeOut, motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";

import { FlyingWindow } from "./flying-window";
import { Resolution } from "./resolution";
import { Ring } from "./ring";
import { STATEMENT_CLASS } from "./statement";
import { useWindowScale } from "./use-window-scale";
import { WINDOWS } from "./window-spots";

// scroll progress eases toward the reader instead of snapping, settling in about a third of a second
const SMOOTH = { stiffness: 140, damping: 30, mass: 0.6, restDelta: 0.0001 };

interface BeatProps {
  opacity: MotionValue<number>;
  filter: MotionValue<string>;
  y?: MotionValue<number>;
  z: number;
  children: ReactNode;
}

function Beat({ opacity, filter, y, z, children }: BeatProps) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center px-5"
      style={{ opacity, filter, y, zIndex: z }}
    >
      {children}
    </motion.div>
  );
}

// the page holds still while three moments play, driven by scroll in both directions
export function MovingStory() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const size = useWindowScale();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  // the spring keeps every value on one clock; otherwise opacity and blur would move to the browser's scroll timeline
  const progress = useSpring(scrollYProgress, SMOOTH);

  const oneOpacity = useTransform(progress, [0.22, 0.3], [1, 0]);
  const oneBlur = useTransform(progress, [0.22, 0.3], ["blur(0px)", "blur(5px)"]);

  const twoOpacity = useTransform(progress, [0.24, 0.32, 0.56, 0.6], [0, 1, 1, 0]);
  const twoBlur = useTransform(progress, [0.24, 0.32, 0.56, 0.6], ["blur(5px)", "blur(0px)", "blur(0px)", "blur(5px)"]);

  const endOpacity = useTransform(progress, [0.62, 0.66], [0, 1]);
  const endBlur = useTransform(progress, [0.62, 0.66], ["blur(5px)", "blur(0px)"]);
  const endY = useTransform(progress, [0.62, 0.66], [14, 0], { ease: easeOut });

  return (
    <div ref={sectionRef} className="relative h-[420vh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        <Ring progress={progress} />

        <div aria-hidden="true">
          {WINDOWS.map((win, i) => (
            <FlyingWindow key={i} win={win} index={i} progress={progress} size={size} />
          ))}
        </div>

        {/* a soft glow in the page colour under the words, so no wire or window ever runs through a line of text */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[36]"
          style={{
            background:
              "radial-gradient(40% 21% at 50% 50%, var(--background) 58%, color-mix(in oklab, var(--background) 62%, transparent) 78%, transparent 100%)",
          }}
        />

        <Beat opacity={oneOpacity} filter={oneBlur} z={40}>
          <h2 id="story-heading" className={STATEMENT_CLASS}>
            Your AI talks to everyone.
          </h2>
        </Beat>
        <Beat opacity={twoOpacity} filter={twoBlur} z={40}>
          <p className={STATEMENT_CLASS}>Some of them want to break it.</p>
        </Beat>
        <Beat opacity={endOpacity} filter={endBlur} y={endY} z={50}>
          <Resolution />
        </Beat>
      </div>
    </div>
  );
}
