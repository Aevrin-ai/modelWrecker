import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { CheckCircleLine, type IconComponent } from "@/components/ui/solar-icons";
import { EASE } from "./tokens";

/*
  The pieces every product mockup is built from: a floating app card for the
  bigger stories, a list panel for the cards, rows, icon tiles, a status, tags,
  severity, and a pointer that clicks. Big type (15 to 18px), a lot of air, one
  idea per mockup, so each reads in a glance. Every mockup is a picture:
  role="img" with a one-sentence label, and its insides hidden from screen
  readers so the label is what they hear.
*/

// A floating app window: white, soft-edged, lifted off the scene behind it.
export function AppCard({ className, children, label }: { className?: string; children: ReactNode; label?: string }) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-white text-slate-900 ring-1 ring-slate-900/10 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10",
        "shadow-float",
        className,
      )}
    >
      <div aria-hidden={label ? true : undefined} className="contents">
        {children}
      </div>
    </div>
  );
}

// The list panel a card holds: a title and a count, then rows.
export function Panel({
  title,
  meta,
  className,
  children,
  label,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "h-full overflow-hidden rounded-xl border border-slate-900/10 bg-slate-50 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100",
        className,
      )}
    >
      <div aria-hidden={label ? true : undefined} className="contents">
        {title && (
          <div className="flex items-baseline gap-3 py-5 pr-14 pl-6 sm:pl-8">
            <span className="text-[18px] font-semibold">{title}</span>
            {meta && <span className="ml-auto text-[14px] text-slate-500 tabular-nums dark:text-slate-400">{meta}</span>}
          </div>
        )}
        <div className="divide-y divide-slate-900/[0.08] border-t border-slate-900/[0.08] dark:divide-white/[0.08] dark:border-white/[0.08]">
          {children}
        </div>
      </div>
    </div>
  );
}

// An icon in a soft square, the way an app shows what a row is.
export function Tile({
  icon: Icon,
  className,
  iconClassName,
  children,
}: {
  icon?: IconComponent;
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
}) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-white/10", className)}>
      {Icon ? <Icon className={cn("size-5 text-slate-700 dark:text-slate-300", iconClassName)} /> : children}
    </span>
  );
}

export function Row({
  icon,
  tile,
  title,
  sub,
  right,
  className,
  highlight,
}: {
  icon?: IconComponent;
  tile?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 py-4 pr-14 pl-6 transition-colors duration-500 sm:pl-8",
        highlight && "bg-slate-900/[0.04] dark:bg-white/[0.06]",
        className,
      )}
    >
      {tile ?? (icon && <Tile icon={icon} />)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px]">{title}</span>
        {sub && <span className="block truncate text-[14px] text-slate-600 dark:text-slate-400">{sub}</span>}
      </span>
      {right}
    </div>
  );
}

const STATUS = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-500",
  info: "bg-sky-500",
  idle: "bg-slate-300 dark:bg-slate-600",
} as const;

// A coloured dot and a word: the status of a row at a glance.
export function Status({
  tone = "good",
  children,
  className,
}: {
  tone?: keyof typeof STATUS;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 text-[15px] text-slate-700 dark:text-slate-300", className)}>
      <span className={cn("size-2 rounded-full", STATUS[tone])} />
      {children}
    </span>
  );
}

export function Done({ className }: { className?: string }) {
  return <CheckCircleLine className={cn("size-5 shrink-0 text-emerald-600 dark:text-emerald-400", className)} />;
}

export { Tag, SeverityTag } from "./tags";

// Fades and rises into place whenever `show` turns true.
export function Appear({
  show,
  delay = 0,
  className,
  children,
  y = 8,
}: {
  show: boolean;
  delay?: number;
  className?: string;
  children: ReactNode;
  y?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={false}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={reduce ? { duration: 0 } : { duration: 0.45, delay: show ? delay : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/*
  One of several views that take turns in the same place. Put them all in one
  grid (`className="grid"` on the parent): they share a cell, so the card keeps
  the height of the tallest view and never jumps as they swap.
*/
export function View({ show, className, children }: { show: boolean; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("col-start-1 row-start-1 min-w-0", !show && "pointer-events-none", className)}
      initial={false}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/*
  The pointer that clicks through a mockup. Positions are percentages of the
  mockup, so it lands in the same place at any size. Decorative: the real
  controls work without it, and it is not drawn at all for reduced motion.
*/
export function Cursor({ x, y, pressed = false, visible = true }: { x: number; y: number; pressed?: boolean; visible?: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-30"
      initial={false}
      animate={{ left: `${x}%`, top: `${y}%`, opacity: visible ? 1 : 0, scale: pressed ? 0.85 : 1 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]">
        <path d="M5 3.5 19 12l-6.6 1.7L9 20.5z" fill="#020617" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}

// A small spinner for a step still running.
export function Spinner() {
  return (
    <span className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 motion-reduce:animate-none dark:border-white/20 dark:border-t-white" />
  );
}

// The red, amber and green buttons at the top of an app window.
export function WindowDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex gap-1.5", className)}>
      <span className="size-[1em] rounded-full bg-[#ff5f57]" />
      <span className="size-[1em] rounded-full bg-[#febc2e]" />
      <span className="size-[1em] rounded-full bg-[#28c840]" />
    </span>
  );
}
