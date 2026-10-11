import { useRef, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import {
  easeIn,
  easeOut,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Ring } from "./ring";
import { STEPS, type Step } from "./steps";
import {
  AgentTaskWindow,
  ApiRequestWindow,
  CustomerTableWindow,
  DocumentSearchWindow,
  McpToolsWindow,
  SupportChatWindow,
  SystemPromptWindow,
} from "./windows";

/*
  The Story, told as you scroll (Activepieces' "dream stage").

  The page holds still while three moments play: your AI talks to everyone;
  some of them want to break it, as the places your AI lives pile up around
  the words; then the pile is drawn into the middle and modelWrecker appears,
  ringed by the nine steps of a run. Scroll drives every frame, eased by a
  spring so it glides rather than ticks, and it plays backwards just as well.

  The windows need a wide screen, so below lg the section shows only the final
  frame, still, the way Activepieces does on a phone. Anyone who prefers less
  motion gets the three moments as plain sections.
*/

// Scroll progress is eased toward where the reader is rather than snapped to
// it, settling in about a third of a second.
const SMOOTH = { stiffness: 140, damping: 30, mass: 0.6, restDelta: 0.0001 };

/* The windows */

type WindowSpot = {
  Comp: ComponentType;
  at: [number, number];
  tilt: number;
  from: [number, number, number];
  start: number;
  front: boolean;
};

// Where each window rests (left and top of the stage, in percent), its tilt,
// where it flies in from (vw, vh, tilt), and when it sets off. The first three
// sit behind the words and the rest in front, so the words read as caught in
// the middle of the pile.
const WINDOWS: WindowSpot[] = [
  { Comp: SystemPromptWindow, at: [50, 32], tilt: 2, from: [0, -115, 4], start: 0.3, front: false },
  { Comp: CustomerTableWindow, at: [22, 34], tilt: -4, from: [-115, -31, -8], start: 0.312, front: false },
  { Comp: McpToolsWindow, at: [78, 34], tilt: 3, from: [115, -42, 6], start: 0.33, front: false },
  { Comp: ApiRequestWindow, at: [21, 71], tilt: 5, from: [-89, 63, 10], start: 0.345, front: true },
  { Comp: SupportChatWindow, at: [39, 66], tilt: -2, from: [-26, 100, -4], start: 0.37, front: true },
  { Comp: DocumentSearchWindow, at: [68, 59], tilt: 6, from: [73, 13, 12], start: 0.35, front: true },
  { Comp: AgentTaskWindow, at: [79, 70], tilt: -5, from: [73, 58, -10], start: 0.385, front: true },
];
const FLY_IN = 0.14;
const LEAVE = 0.605;
const LEAVE_GAP = 0.009;
const LEAVE_FOR = 0.065;
const linear = (t: number) => t;

function FlyingWindow({
  win,
  index,
  progress,
  size,
}: {
  win: WindowSpot;
  index: number;
  progress: MotionValue<number>;
  size: number;
}) {
  const [ax, ay] = win.at;
  const [fx, fy, fr] = win.from;
  const a = win.start;
  const b = a + FLY_IN;
  const c = LEAVE + index * LEAVE_GAP;
  const d = c + LEAVE_FOR;
  const ease = [easeOut, linear, easeIn];

  // In from off screen, rest, then drawn into the middle of the stage.
  const x = useTransform(progress, [a, b, c, d], [`${fx}vw`, "0vw", "0vw", `${50 - ax}vw`], { ease });
  const y = useTransform(progress, [a, b, c, d], [`${fy}vh`, "0vh", "0vh", `${50 - ay}vh`], { ease });
  const rotate = useTransform(progress, [a, b, c, d], [fr, win.tilt, win.tilt, 0], { ease });
  const scale = useTransform(progress, [c, d], [size, size * 0.05], { ease: easeIn });
  const opacity = useTransform(progress, [a, a + 0.004, c, d - 0.01], [0, 1, 1, 0]);

  const { Comp } = win;
  return (
    // A point with no size at the window's resting place, so it scales and
    // tilts about its own centre rather than about a corner.
    <motion.div
      className="absolute size-0 will-change-transform"
      style={{ left: `${ax}%`, top: `${ay}%`, x, y, rotate, scale, opacity, zIndex: win.front ? 35 : 33 }}
    >
      <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
        <Comp />
      </div>
    </motion.div>
  );
}

// The windows are drawn at laptop size and scale with the screen, never below
// a size that still reads as a window. A short screen shrinks them too, so the
// pile never swallows the words in the middle.
function windowScale() {
  return Math.min(1.12, Math.max(0.5, Math.min(window.innerWidth / 1440, window.innerHeight / 900)));
}
function useWindowScale() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    windowScale,
    () => 1,
  );
}

/* The words */

const STATEMENT =
  "font-heading text-foreground mx-auto max-w-[14ch] text-center text-5xl leading-[1.04] font-bold text-balance md:text-7xl xl:text-[84px]";

function Resolution({ heading: Heading = "h3", id, compact }: { heading?: "h2" | "h3"; id?: string; compact?: boolean }) {
  return (
    <div className="mx-auto text-center">
      <div className="flex items-center justify-center gap-3 md:gap-4">
        <img
          src="/aevrin-logo.png"
          alt=""
          width={26}
          height={28}
          className={cn("w-auto", compact ? "h-10" : "h-12 md:h-16")}
        />
        <span
          className={cn(
            "text-foreground font-semibold tracking-tight",
            compact ? "text-[32px]" : "text-5xl md:text-6xl",
          )}
        >
          modelWrecker
        </span>
      </div>
      <Heading
        id={id}
        className={cn(
          "font-heading text-foreground mx-auto mt-5 max-w-[13ch] leading-[1.04] font-bold text-balance",
          compact ? "text-[clamp(2.25rem,9.5vw,3rem)]" : "text-5xl md:text-7xl",
        )}
      >
        Find the weak spots first.
      </Heading>
    </div>
  );
}

function StepChip({ step }: { step: Step }) {
  const Icon = step.icon;
  return (
    <div className="bg-card border-border flex items-center gap-2.5 rounded-xl border px-3 py-2.5">
      <Icon aria-hidden="true" className="text-brand size-4 shrink-0" />
      <span className="text-foreground text-[15px] leading-tight">{step.label}</span>
    </div>
  );
}

// The nine steps of a run, in order, for screens without room for the ring.
function StepGrid({ className }: { className?: string }) {
  return (
    <ol aria-label="The steps of a run" className={cn("mx-auto grid w-full max-w-md grid-cols-2 gap-2", className)}>
      {STEPS.map((step) => (
        <li key={step.id}>
          <StepChip step={step} />
        </li>
      ))}
    </ol>
  );
}

// Reduced motion: the same three moments, one after another, holding still.
function StillStory() {
  return (
    <div className="max-w-container mx-auto space-y-24 py-24 md:py-32">
      <h2 id="story-heading" className={STATEMENT}>
        Your AI talks to everyone.
      </h2>
      <p className={STATEMENT}>Some of them want to break it.</p>
      <div>
        <Resolution />
        <StepGrid className="mt-12" />
      </div>
    </div>
  );
}

// Below lg: only the final frame, still, like Activepieces on a phone. The
// first two lines are still there for a screen reader.
function FinalFrame() {
  return (
    <div className="max-w-container mx-auto flex min-h-svh flex-col justify-center py-24">
      <p className="sr-only">Your AI talks to everyone. Some of them want to break it.</p>
      <Resolution heading="h2" id="story-heading" compact />
      <StepGrid className="mt-10" />
    </div>
  );
}

function Beat({
  opacity,
  filter,
  y,
  z,
  children,
}: {
  opacity: MotionValue<number>;
  filter: MotionValue<string>;
  y?: MotionValue<number>;
  z: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center px-5"
      style={{ opacity, filter, y, zIndex: z }}
    >
      {children}
    </motion.div>
  );
}

function MovingStory() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const size = useWindowScale();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  // The spring also keeps every value here on one clock; Motion would
  // otherwise hand opacity and blur to the browser's own scroll timeline while
  // the rest is computed here.
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

        {/* A soft glow in the page colour over the pile and under the words,
            so neither a wire nor a window ever runs through a line of text. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[36]"
          style={{
            background:
              "radial-gradient(40% 21% at 50% 50%, var(--background) 58%, color-mix(in oklab, var(--background) 62%, transparent) 78%, transparent 100%)",
          }}
        />

        <Beat opacity={oneOpacity} filter={oneBlur} z={40}>
          <h2 id="story-heading" className={STATEMENT}>
            Your AI talks to everyone.
          </h2>
        </Beat>
        <Beat opacity={twoOpacity} filter={twoBlur} z={40}>
          <p className={STATEMENT}>Some of them want to break it.</p>
        </Beat>
        <Beat opacity={endOpacity} filter={endBlur} y={endY} z={50}>
          <Resolution />
        </Beat>
      </div>
    </div>
  );
}

export function Story() {
  const reduce = useReducedMotion();
  const wide = useMediaQuery("(min-width: 64rem)");
  return (
    <section id="story" aria-labelledby="story-heading" className="bg-background relative">
      {reduce ? <StillStory /> : wide ? <MovingStory /> : <FinalFrame />}
    </section>
  );
}
