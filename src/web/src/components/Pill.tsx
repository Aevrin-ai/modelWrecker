import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type Tone = "emerald" | "blue" | "purple" | "amber" | "orange" | "red" | "neutral";

// Folio table pill: rounded-lg, 1px border at 20% of the hue, 10% fill, 300 text.
const tones: Record<Tone, string> = {
  emerald: "border-emerald-base/20 bg-emerald-base/10 text-emerald",
  blue: "border-blue-base/20 bg-blue-base/10 text-blue",
  purple: "border-purple-base/20 bg-purple-base/10 text-purple",
  amber: "border-amber-base/20 bg-amber-base/10 text-amber",
  orange: "border-orange-base/20 bg-orange-base/10 text-orange",
  red: "border-red-base/20 bg-red-base/10 text-red",
  neutral: "border-border bg-elevated text-foreground/90",
};

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] font-medium leading-none lg:text-xs",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export const severityTone = {
  critical: "red",
  high: "orange",
  medium: "amber",
  low: "blue",
} as const satisfies Record<string, Tone>;
