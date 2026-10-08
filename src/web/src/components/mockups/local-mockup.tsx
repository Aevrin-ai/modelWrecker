import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import {
  Bolt,
  Chart,
  CheckCircleLine,
  Cloud,
  CpuBolt,
  FileText,
  Key,
  Laptop,
  Layers,
  Scale,
  ShieldCheck,
  Target,
  User,
  type IconComponent,
} from "@/components/ui/solar-icons";
import { AppCard, Status, Tag, Tile } from "./kit";
import { EASE } from "./tokens";

/*
  Local-first, as a picture: two boxes. "Your machine" runs the attacker, the
  target connection and the judge, with your keys or a local model, and the
  attack traffic moves only inside it. A dashed line carries a results
  summary to the Aevrin cloud, which handles sign-in, the dashboard, billing
  and plans, and never runs an attack.
*/

// 0 ready, 1 attacker to target, 2 reply to the judge, 3 the verdict,
// 4 the summary reaches the dashboard, held.
const STEPS = [0.8, 1.5, 1.5, 1.2, 3.4] as const;
const SUMMARY = 4;

const NODES: { name: string; sub: string; icon: IconComponent }[] = [
  { name: "Attacker", sub: "Writes the attack messages", icon: Bolt },
  { name: "Target connection", sub: "Talks to the AI you test", icon: Target },
  { name: "Judge", sub: "Decides what worked", icon: Scale },
];

const CLOUD: { name: string; icon: IconComponent }[] = [
  { name: "Sign-in", icon: User },
  { name: "Dashboard", icon: Chart },
  { name: "Billing", icon: FileText },
  { name: "Plans", icon: Layers },
];

// The link between two parts of the machine: grey, lime once used, with a
// packet running down it while traffic is on the move.
function Wire({ on, moving }: { on: boolean; moving: boolean }) {
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

function Box({ icon, title, right, className, children }: { icon: IconComponent; title: string; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-900/10 sm:p-5 dark:bg-white/[0.04] dark:ring-white/10", className)}>
      <div className="mb-4 flex items-center gap-3">
        <Tile icon={icon} className="bg-white dark:bg-white/10" />
        <span className="text-[17px] font-semibold">{title}</span>
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  );
}

export function LocalMockup({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { phase } = useAutoplay(ref, STEPS);
  const sent = phase >= SUMMARY;

  const nodeRight = (i: number) => {
    if (i === 0 && phase === 1) return <Status tone="info">Sending</Status>;
    if (i === 1 && phase === 2) return <Status tone="info">Reply in</Status>;
    if (i === 2 && phase >= 3) return <Tag tone="warn">Worked</Tag>;
    return null;
  };
  const active = (i: number) => (i === 0 && phase === 1) || (i === 1 && phase === 2) || (i === 2 && phase === 3);

  return (
    <AppCard
      className={cn("mx-auto w-full max-w-[920px]", className)}
      label="Your machine runs the attacker, the target connection and the judge with your keys or a local model, and sends only a results summary to the Aevrin cloud, which handles sign-in, the dashboard, billing and plans and never runs an attack."
    >
      <div ref={ref} className="flex flex-col p-4 sm:p-6 lg:flex-row lg:items-center">
        {/* Your machine: where every attack runs. */}
        <Box
          icon={Laptop}
          title="Your machine"
          right={<Tag tone="lime" className="max-sm:hidden">Attacks run here</Tag>}
          className="lg:flex-[1.35]"
        >
          {NODES.map((node, i) => (
            <div key={node.name}>
              {i > 0 && <Wire on={phase >= i} moving={phase === i} />}
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 ring-1 transition-[box-shadow] duration-500 dark:bg-slate-900",
                  active(i) ? "ring-lime ring-2" : "ring-slate-900/10 dark:ring-white/10",
                )}
              >
                <Tile icon={node.icon} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{node.name}</span>
                  <span className="block truncate text-[13px] text-slate-500 dark:text-slate-400">{node.sub}</span>
                </span>
                {nodeRight(i)}
              </div>
            </div>
          ))}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10">
              <Key className="size-4 text-slate-600 dark:text-slate-300" />
              Your keys
            </span>
            <span className="text-slate-500 dark:text-slate-400">or</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10">
              <CpuBolt className="size-4 text-slate-600 dark:text-slate-300" />
              Local model
            </span>
          </div>
        </Box>

        {/* The only thing that leaves the machine by default. */}
        <div className="relative flex h-16 items-center justify-center lg:h-auto lg:w-[136px] lg:shrink-0 lg:self-stretch">
          <span
            className={cn(
              "absolute border-dashed transition-colors duration-500",
              "inset-y-0 left-1/2 border-l-2 lg:inset-x-0 lg:top-1/2 lg:bottom-auto lg:left-0 lg:border-t-2 lg:border-l-0",
              sent ? "border-slate-500 dark:border-slate-400" : "border-slate-300 dark:border-white/20",
            )}
          />
          <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[13px] font-medium whitespace-nowrap ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/15">
            {sent && <CheckCircleLine className="size-4 text-emerald-600 dark:text-emerald-400" />}
            results summary
          </span>
        </div>

        {/* The Aevrin cloud: a thin control plane. */}
        <Box icon={Cloud} title="Aevrin cloud" className="lg:flex-1">
          <ul className="space-y-1">
            {CLOUD.map(({ name, icon: Icon }) => (
              <li key={name} className="flex h-9 items-center gap-3 text-[15px]">
                <Icon className="size-[18px] shrink-0 text-slate-500 dark:text-slate-400" />
                {name}
                {name === "Dashboard" && sent && <Tag tone="good" className="ml-auto">Updated</Tag>}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[14px] font-semibold ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10">
            <ShieldCheck className="size-[18px] shrink-0 text-emerald-600 dark:text-emerald-400" />
            Never runs an attack
          </p>
        </Box>
      </div>
    </AppCard>
  );
}
