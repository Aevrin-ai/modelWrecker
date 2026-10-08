import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import { Bolt, Lock, Scale, Target, type IconComponent } from "@/components/ui/solar-icons";
import { AppCard, Tag, Tile } from "./kit";
import { EASE } from "./tokens";

/*
  Two pictures for "Trust a result, not a lucky try". The first replays one
  win ten times: the tries fill in as worked or failed, the success rate
  settles, and its likely range (a 95% Wilson interval) narrows until the
  win becomes a confirmed finding. The second shows the three model roles
  with walls between them.
*/

// The ten replays, in order: 1 worked, 0 failed. Seven of ten work.
const RESULTS = [1, 1, 0, 1, 1, 1, 0, 1, 0, 1] as const;
// How many replays are done at each phase.
const DONE = [0, 4, 7, 10, 10] as const;
// 0 one possible win, 1 to 3 the replays, 4 confirmed, held.
const REPLAY_STEPS = [0.9, 1.8, 1.6, 1.6, 3.4] as const;
const CONFIRMED = 4;
const STAGGER = 0.22;

// The 95% Wilson score interval for k successes in n tries, as fractions.
function wilson(k: number, n: number) {
  const z = 1.96;
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

const pct = (x: number) => Math.round(x * 100);

function Dot({ done, worked, delay }: { done: boolean; worked: boolean; delay: number }) {
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

export function ReplaysMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { phase } = useAutoplay(ref, REPLAY_STEPS);

  const n = DONE[phase];
  const before = phase > 0 ? DONE[phase - 1] : 0;
  const k = RESULTS.slice(0, n).reduce<number>((sum, r) => sum + r, 0);
  const range = n > 0 ? wilson(k, n) : { lo: 0.5, hi: 0.5 };
  const rate = n > 0 ? k / n : 0.5;
  const confirmed = phase >= CONFIRMED;
  // The rate moves once the new dots have landed.
  const settle = reduce ? { duration: 0 } : { duration: 0.8, delay: Math.max(0, n - before) * STAGGER, ease: EASE };

  return (
    <div ref={ref} className="h-full">
      <AppCard
        className="flex h-full flex-col"
        label="One win replayed 10 times: 7 of 10 worked, a success rate of 70%, likely 40% to 89%, so it becomes a confirmed finding."
      >
        <div className="flex items-baseline gap-3 px-5 pt-5 sm:px-6">
          <span className="text-[16px] font-semibold">Replaying 10 times</span>
          <span className="ml-auto text-[14px] text-slate-500 tabular-nums dark:text-slate-400">{n} of 10</span>
        </div>

        <div className="grid grid-cols-10 gap-1.5 px-5 pt-4 sm:gap-2 sm:px-6">
          {RESULTS.map((r, i) => (
            <Dot key={i} done={i < n} worked={r === 1} delay={Math.max(0, i - before) * STAGGER} />
          ))}
        </div>
        <p className="px-5 pt-2.5 text-[13px] text-slate-500 tabular-nums sm:px-6 dark:text-slate-400">
          {k} worked, {n - k} failed
        </p>

        <div className="px-5 pt-4 sm:px-6">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[26px] leading-none font-semibold tabular-nums">{n > 0 ? `${pct(k / n)}%` : "1 win"}</span>
            <span className="text-[15px] text-slate-600 tabular-nums dark:text-slate-300">
              {n > 0 ? `likely ${pct(range.lo)}% to ${pct(range.hi)}%` : "now replaying it"}
            </span>
          </p>
          <div className="relative mt-3 h-3 rounded-full bg-slate-100 dark:bg-white/10">
            <motion.span
              className="bg-lime/70 dark:bg-lime/50 absolute inset-y-0 rounded-full"
              initial={false}
              animate={{ left: `${range.lo * 100}%`, width: `${(range.hi - range.lo) * 100}%`, opacity: n > 0 ? 1 : 0 }}
              transition={settle}
            />
            <motion.span
              className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-slate-900 dark:bg-white"
              initial={false}
              animate={{ left: `${rate * 100}%`, opacity: n > 0 ? 1 : 0 }}
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

/* The three roles */

const ROLES: { name: string; text: string; model: string; icon: IconComponent }[] = [
  { name: "Attacker", text: "Picks and changes the attacks.", model: "Model 1", icon: Bolt },
  { name: "Target", text: "The AI being tested.", model: "Model 2", icon: Target },
  { name: "Judge", text: "Decides what worked.", model: "Model 3", icon: Scale },
];
// Each role lights in turn; the last holds before it starts again.
const ROLE_STEPS = [1.6, 1.6, 3.2] as const;

// A wall between two roles: a striped bar with a lock in the middle.
function Wall() {
  return (
    <div className="relative flex h-7 items-center px-2">
      <span className="h-2.5 flex-1 rounded-full bg-[repeating-linear-gradient(135deg,rgb(15_23_42/0.22)_0_5px,transparent_5px_10px)] dark:bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.22)_0_5px,transparent_5px_10px)]" />
      <span className="absolute left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full bg-white ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/15">
        <Lock className="size-4 text-slate-600 dark:text-slate-300" />
      </span>
    </div>
  );
}

export function RolesMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase } = useAutoplay(ref, ROLE_STEPS);
  return (
    <div ref={ref} className="h-full">
      <AppCard
        className="flex h-full flex-col justify-center p-4 sm:p-5"
        label="Three separate models with walls between them: the attacker picks and changes the attacks, the target is the AI being tested, and the judge decides what worked."
      >
        {ROLES.map((role, i) => (
          <div key={role.name}>
            {i > 0 && <Wall />}
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 ring-1 transition-[box-shadow,background-color] duration-500 dark:bg-white/[0.04]",
                phase === i ? "bg-lime/15 ring-lime ring-2 dark:bg-lime/10" : "ring-slate-900/10 dark:ring-white/10",
              )}
            >
              <Tile icon={role.icon} className="bg-white dark:bg-white/10" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{role.name}</span>
                <span className="block text-[14px] text-slate-600 dark:text-slate-400">{role.text}</span>
              </span>
              <Tag className="max-[360px]:hidden">{role.model}</Tag>
            </div>
          </div>
        ))}
      </AppCard>
    </div>
  );
}
