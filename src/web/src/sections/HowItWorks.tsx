import { CornerDownRight, Settings, ShieldCheck } from "lucide-react";
import { Container } from "../components/Container";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";
import { Logo } from "../components/Logo";
import { Pill } from "../components/Pill";
import { howItWorks } from "../data/content";
import { cn } from "../lib/cn";

function TargetsVisual() {
  const items = [
    { name: "support-bot", meta: "chat target · authorized", dot: "bg-blue-500", letter: "C" },
    { name: "ops-agent", meta: "agent · tool calls observed only", dot: "bg-violet-500", letter: "A" },
    { name: "kb-rag", meta: "rag · 3 documents ingested", dot: "bg-emerald-500", letter: "R" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      {items.map((it, i) => (
        <div
          key={it.name}
          className={cn(
            "flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg shadow-black/40",
            i > 0 && "-mt-3",
            i === 1 && "mx-2 opacity-80",
            i === 2 && "mx-4 opacity-60"
          )}
          style={{ zIndex: 10 - i, position: "relative" }}
        >
          <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", it.dot)}>
            {it.letter}
            {i === 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <ShieldCheck className="size-2.5 text-white" />
              </span>
            )}
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate text-[13px] font-semibold">{it.name} registered</span>
            <span className="block truncate text-[11px] text-muted">{it.meta}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={cn("flex h-4 w-7 items-center rounded-full p-0.5", on ? "bg-blue-500" : "bg-input")}>
      <span className={cn("size-3 rounded-full bg-white transition-transform", on && "translate-x-3")} />
    </span>
  );
}

function ToolsVisual() {
  return (
    <div className="relative mx-auto flex w-full max-w-[400px] items-center justify-center">
      <div className="absolute left-0 w-[140px] rounded-xl border border-border bg-card/80 p-3 text-left opacity-70">
        <div className="mb-2 font-mono text-[11px] font-semibold text-purple">garak</div>
        <div className="text-[11px] text-muted">Vulnerability probes loaded as attacks.</div>
      </div>
      <div className="absolute right-0 w-[140px] rounded-xl border border-border bg-card/80 p-3 text-left opacity-70">
        <div className="flex justify-end">
          <Toggle on />
        </div>
        <div className="mt-1 text-[11px] font-semibold">OpenAI-compatible</div>
        <div className="text-[11px] text-muted">Any chat endpoint</div>
      </div>
      <div className="relative z-10 w-[210px] rounded-xl border border-border bg-card p-4 text-left shadow-xl shadow-black/50">
        <div className="flex items-start justify-between">
          <span className="font-mono text-[13px] font-bold text-emerald">PyRIT</span>
          <Toggle on />
        </div>
        <div className="mt-2 text-sm font-semibold">PAIR and TAP</div>
        <div className="mt-0.5 text-xs text-muted">Iterative attacker-model algorithms, judged by our judge.</div>
        <div className="mt-4 flex items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-xs font-medium">
          <Settings className="size-3.5" /> Manage
        </div>
      </div>
    </div>
  );
}

function ReportVisual() {
  return (
    <div className="mx-auto w-full max-w-[360px] text-left text-[13px]">
      <div className="ml-auto w-fit rounded-xl bg-elevated px-3 py-2 text-foreground">red team support-bot for prompt leaks</div>
      <p className="mt-3 font-medium">Campaign finished.</p>
      <p className="font-medium">1 verified finding:</p>
      <div className="mt-2 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted">F-0142 · OWASP LLM01</span>
          <Logo size={14} showWord={false} />
        </div>
        <div className="mt-1 font-semibold">System prompt leak</div>
        <div className="mt-2 flex gap-1.5">
          <Pill tone="red">Critical</Pill>
          <Pill tone="emerald">17 / 20 replays</Pill>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted">Suggested action</p>
      <p className="flex items-center gap-1.5 text-[12px]">
        <CornerDownRight className="size-3.5 text-muted" /> Replay F-0142 on the next model version
      </p>
    </div>
  );
}

const visuals = [TargetsVisual, ToolsVisual, ReportVisual];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 py-16 sm:py-20 md:py-28">
      <Container>
        <SectionHeader eyebrow={howItWorks.eyebrow} title={howItWorks.title} description={howItWorks.description} />
        <Reveal className="mt-12 md:mt-16">
          <div className="overflow-hidden rounded-2xl border border-border">
            <div className="grid divide-border max-md:divide-y md:grid-cols-3 md:divide-x">
              {howItWorks.steps.map((s, i) => {
                const Visual = visuals[i];
                return (
                  <div key={s.title} className="flex flex-col p-6 md:p-10">
                    <div className="flex h-[260px] items-center justify-center">
                      <Visual />
                    </div>
                    <div className="mt-6 text-center">
                      <h3 className="text-balance font-semibold">{s.title}</h3>
                      <p className="mx-auto mt-3 max-w-xs text-balance text-[15px] leading-relaxed text-muted md:text-base">
                        {s.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
