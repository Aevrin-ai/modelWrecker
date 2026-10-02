import { useEffect, useState } from "react";
import { ArrowUp, Infinity as InfinityIcon, ChevronDown, Plus, X } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { Container } from "../components/Container";
import { Reveal } from "../components/Reveal";
import { Logo } from "../components/Logo";
import { features } from "../data/content";
import { cn } from "../lib/cn";

// Nguyen feature section: big sans headline + right paragraph, then a 2 + 3
// grid of cards. Each card has a product visual on top and a two-tone caption.

function Hatch({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 9px)",
      }}
    />
  );
}

function BoardVisual() {
  return (
    <div className="mx-auto grid w-full max-w-[450px] grid-cols-2 gap-2.5 text-left">
      <div className="rounded-2xl border border-border bg-background/60 p-2">
        <p className="px-1.5 pb-2 pt-1 text-[11px] font-semibold tracking-wider text-muted">RUNNING</p>
        <div className="relative">
          <Hatch className="absolute inset-0" />
          <div className="relative rotate-[-3deg] rounded-xl border border-border bg-card p-3 shadow-xl shadow-black/50">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-red">
              <span className="size-1.5 rounded-full bg-red-base" /> CRITICAL
            </p>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug">System prompt leak via crescendo</p>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
              <span className="flex size-4 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">C</span>
              support-bot
            </p>
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-border bg-card/70 p-3 opacity-70">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-amber">
            <span className="size-1.5 rounded-full bg-amber-base" /> MEDIUM
          </p>
          <p className="mt-1.5 text-[13px] font-semibold leading-snug">Tool description poisoning</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-background/60 p-2">
        <p className="px-1.5 pb-2 pt-1 text-[11px] font-semibold tracking-wider text-muted">VERIFIED</p>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-emerald">
            <span className="size-1.5 rounded-full bg-emerald-base" /> FINDING
          </p>
          <p className="mt-1.5 text-[13px] font-semibold leading-snug">Forbidden tool call</p>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
            <span className="flex size-4 items-center justify-center rounded-full bg-violet-500 text-[8px] font-bold text-white">A</span>
            14 / 20 replays
          </p>
        </div>
        <div className="relative mt-2 h-[92px]">
          <Hatch className="absolute inset-0" />
          <span className="absolute inset-0 m-auto flex size-8 items-center justify-center rounded-full bg-elevated">
            <Plus className="size-4 text-muted" />
          </span>
        </div>
      </div>
    </div>
  );
}

function AlertVisual() {
  return (
    <div className="relative mx-auto flex w-full max-w-[460px] items-center gap-6">
      <div className="hidden w-[120px] shrink-0 space-y-2 sm:block">
        <div className="h-16 rounded-xl bg-elevated" />
        <div className="h-1.5 w-full rounded bg-elevated" />
        <div className="h-1.5 w-4/5 rounded bg-elevated" />
        <div className="h-1.5 w-3/5 rounded bg-elevated" />
        <div className="h-1.5 w-4/5 rounded bg-elevated" />
      </div>
      <div className="relative flex-1">
        <span className="absolute -left-4 -top-4 flex size-8 items-center justify-center rounded-full bg-card ring-2 ring-blue-500/60">
          <Logo size={14} showWord={false} />
        </span>
        <div className="rounded-2xl border border-border bg-card text-left shadow-xl shadow-black/50">
          <div className="flex gap-3 p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border">
              <Logo size={16} showWord={false} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center justify-between text-[15px] font-semibold">
                Aevrin <span className="flex items-center gap-1 text-[11px] font-normal text-muted">3:48 pm <X className="size-3" /></span>
              </p>
              <p className="mt-1 text-[14px] leading-snug text-foreground/80">
                New critical finding on support-bot. The system prompt leak reproduced in 17 of 20 replays.
              </p>
              <span className="mt-2 block size-2 rounded-full bg-emerald-base" />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <span className="text-[13px] text-muted">Open finding F-0142...</span>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary">
              <ArrowUp className="size-3.5 text-primary-foreground" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function JudgeVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div className="absolute inset-x-0 top-14 rounded-2xl border border-border bg-background/70 p-3 pt-16 text-left">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-[11px] text-muted">
              <InfinityIcon className="size-3" /> Rules
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-[11px] font-medium">
              LLM grader <ChevronDown className="size-3" />
            </span>
          </div>
          <span className="flex size-7 items-center justify-center rounded-full bg-primary">
            <ArrowUp className="size-3.5 text-primary-foreground" />
          </span>
        </div>
      </div>
      <div className="relative mx-5 rounded-2xl border border-border bg-card p-4 text-left shadow-xl shadow-black/50">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="size-2 rounded-full bg-blue-base" /> Judge ensemble
          </span>
          <span className="text-muted">verdict: leak</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {["PII detector", "Secret detector", "Rule match"].map((s) => (
            <div key={s} className="flex items-center justify-between text-[11px] text-muted">
              <span>{s}</span>
              <span className="text-emerald">pass</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-elevated">
            <div className="h-full w-[85%] rounded-full bg-blue-base" />
          </div>
          <span className="text-[11px] font-medium text-blue">0.85</span>
        </div>
      </div>
    </div>
  );
}

const transforms = ["rot13", "reverse", "zero_width", "base64", "leetspeak", "homoglyph", "base64 + rot13"];
const swatch = ["bg-blue-400", "bg-sky-400", "bg-indigo-400", "bg-blue-500", "bg-violet-400", "bg-cyan-400", "bg-blue-300"];

function TransformsVisual() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(3);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % transforms.length), 1800);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <div className="mask-fade-y flex flex-col items-center gap-1.5">
      {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
        const i = (active + offset + transforms.length) % transforms.length;
        const d = Math.abs(offset);
        return (
          <div
            key={offset}
            className="flex items-center gap-2.5 font-mono transition-all duration-500"
            style={{ opacity: 1 - d * 0.25, transform: `scale(${1 - d * 0.08})` }}
          >
            <span className={cn("size-4 rounded", swatch[i])} />
            <span className={cn("text-lg", d === 0 ? "font-semibold text-foreground" : "text-muted")}>{transforms[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// Deterministic heat values so the visual is stable between renders.
const heat = Array.from({ length: 5 }, (_, r) =>
  Array.from({ length: 14 }, (_, c) => ((r * 7 + c * 13 + r * c) % 10) / 10)
);
const strategiesShort = ["crescendo", "pair", "tap", "best_of_n", "many_shot"];

function HeatmapVisual() {
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-2xl border border-border bg-card p-4 text-left shadow-xl shadow-black/40">
      <p className="text-[13px] font-semibold">Attack success rate</p>
      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-[10px] text-muted">Overall ASR</p>
          <p className="flex items-center gap-1.5 text-2xl font-semibold">
            31% <span className="rounded bg-elevated px-1 text-[10px] font-medium text-muted">95% CI</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted">Top strategy</p>
          <p className="flex items-center gap-1.5 text-2xl font-semibold">
            62% <span className="rounded bg-elevated px-1 text-[10px] font-medium text-muted">crescendo</span>
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-1">
        {heat.map((row, r) => (
          <div key={r} className="flex items-center gap-1">
            <span className="w-14 truncate text-[9px] text-muted">{strategiesShort[r]}</span>
            {row.map((v, c) => (
              <span
                key={c}
                className="size-3 rounded-[3px]"
                style={{ background: v < 0.2 ? "#262626" : `rgba(59,130,246,${0.25 + v * 0.75})` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const visuals = [BoardVisual, AlertVisual, JudgeVisual, TransformsVisual, HeatmapVisual];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 py-16 sm:py-24">
      <Container>
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          <Reveal>
            <h2 className="text-balance text-4xl font-medium tracking-[-0.025em] md:text-5xl">{features.title}</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-balance text-lg leading-relaxed text-muted md:text-xl">{features.description}</p>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-3 md:mt-16 lg:grid-cols-6">
          {features.cards.map((c, i) => {
            const Visual = visuals[i];
            const wide = i < 2;
            return (
              <Reveal
                key={c.title}
                delay={0.05 * i}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
                  wide ? "lg:col-span-3" : "lg:col-span-2"
                )}
              >
                <div className={cn("flex items-center justify-center px-6", wide ? "h-[380px] pt-10" : "h-[320px] pt-8")}>
                  <Visual />
                </div>
                <p className="px-6 pb-7 pt-6 text-lg leading-snug md:text-xl">
                  <span className="font-medium text-foreground">{c.title}</span>{" "}
                  <span className="text-muted">{c.body}</span>
                </p>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
