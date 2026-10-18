import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import { AppCard, Tag } from "./kit";
import { EASE } from "./tokens";
import { wilsonInterval } from "./wilson-interval";

export { RolesMockup } from "./roles-mockup";

// the ten replays, in order: 1 worked, 0 failed; seven of ten work
const RESULTS = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1] as const;
// how many replays are done at each phase
const DONE = [0, 4, 7, 10, 10] as const;
// 0 one possible win, 1 to 3 the replays, 4 confirmed, held
const REPLAY_STEPS = [0.9, 1.8, 1.6, 1.6, 3.4] as const;
const CONFIRMED = 4;
const STAGGER = 0.22;

const toPercent = (fraction: number) => Math.round(fraction * 100);

interface DotProps {
  done: boolean;
  worked: boolean;
  delay: number;
}

function Dot({ done, worked, delay }: DotProps) {
  const reduce = useReducedMotion();
  return (
    <span className="relative aspect-square">
      <span className="absolute inset-0 rounded-full border-2 border-dashed border-slate-300 dark:border-white/20" />
      <motion.span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 grid place-items-center rounded-full",
          worked
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            : "bg-white text-slate-400 ring-2 ring-slate-300 ring-inset dark:bg-slate-800 dark:text-slate-500 dark:ring-white/20",
        )}
        initial={false}
        animate={{ scale: done ? 1 : 0.4, opacity: done ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.35, delay: done ? delay : 0, ease: EASE }}
      >
        {worked ? <Check className="size-[55%]" strokeWidth={3} /> : <X className="size-[50%]" strokeWidth={3} />}
      </motion.span>
    </span>
  );
}

// one win replayed ten times: the success rate settles and its likely range narrows until it is a confirmed finding
export function ReplaysMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { phase } = useAutoplay(ref, REPLAY_STEPS);

  const doneCount = DONE[phase];
  const doneBefore = phase > 0 ? DONE[phase - 1] : 0;
  const workedCount = RESULTS.slice(0, doneCount).reduce<number>((sum, result) => sum + result, 0);
  const range = doneCount > 0 ? wilsonInterval(workedCount, doneCount) : { lo: 0.5, hi: 0.5 };
  const rate = doneCount > 0 ? workedCount / doneCount : 0.5;
  const confirmed = phase >= CONFIRMED;
  // the rate moves once the new dots have landed
  const settle = reduce
    ? { duration: 0 }
    : { duration: 0.8, delay: Math.max(0, doneCount - doneBefore) * STAGGER, ease: EASE };

  return (
    <div ref={ref} className="h-full">
      <AppCard
        className="flex h-full flex-col"
        label="One win replayed 10 times: 7 of 10 worked, a success rate of 70%, likely 40% to 89%, so it becomes a confirmed finding."
      >
        <div className="flex items-baseline gap-3 px-5 pt-5 sm:px-6">
          <span className="text-[16px] font-semibold">Replaying 10 times</span>
          <span className="ml-auto text-[14px] text-slate-500 tabular-nums dark:text-slate-400">{doneCount} of 10</span>
        </div>

        <div className="grid grid-cols-10 gap-1.5 px-5 pt-4 sm:gap-2 sm:px-6">
          {RESULTS.map((result, i) => (
            <Dot key={i} done={i < doneCount} worked={result === 1} delay={Math.max(0, i - doneBefore) * STAGGER} />
          ))}
        </div>
        <p className="px-5 pt-2.5 text-[13px] text-slate-500 tabular-nums sm:px-6 dark:text-slate-400">
          {workedCount} worked, {doneCount - workedCount} failed
        </p>

        <div className="px-5 pt-4 sm:px-6">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[26px] leading-none font-semibold tabular-nums">
              {doneCount > 0 ? `${toPercent(workedCount / doneCount)}%` : "1 win"}
            </span>
            <span className="text-[15px] text-slate-600 tabular-nums dark:text-slate-300">
              {doneCount > 0 ? `likely ${toPercent(range.lo)}% to ${toPercent(range.hi)}%` : "now replaying it"}
            </span>
          </p>
          <div className="relative mt-3 h-3 rounded-full bg-slate-100 dark:bg-white/10">
            <motion.span
              className="bg-lime/70 dark:bg-lime/50 absolute inset-y-0 rounded-full"
              initial={false}
              animate={{ left: `${range.lo * 100}%`, width: `${(range.hi - range.lo) * 100}%`, opacity: doneCount > 0 ? 1 : 0 }}
              transition={settle}
            />
            <motion.span
              className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-slate-900 dark:bg-white"
              initial={false}
              animate={{ left: `${rate * 100}%`, opacity: doneCount > 0 ? 1 : 0 }}
              transition={settle}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[12px] text-slate-500 dark:text-slate-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-slate-900/[0.08] px-5 py-3.5 sm:px-6 dark:border-white/[0.08]">
          <span className="text-[14px] text-slate-500 dark:text-slate-400">Status</span>
          <span className="ml-auto">
            {confirmed ? <Tag tone="bad">Confirmed finding</Tag> : <Tag tone="warn">Possible</Tag>}
          </span>
        </div>
      </AppCard>
    </div>
  );
}
