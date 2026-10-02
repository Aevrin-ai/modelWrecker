import { Check, ChevronsUpDown, Crosshair, FileCheck2, Loader2, Plus, ShieldCheck, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import { Container } from "../components/Container";
import { SectionHeader } from "../components/SectionHeader";
import { Reveal } from "../components/Reveal";
import { Logo } from "../components/Logo";
import { bento } from "../data/content";
import { cn } from "../lib/cn";

// Folio bento: a 2/3 + 1/3 row, then three equal cards. Cards are #121212 with
// a #242424 border, 16px radius, dotted texture, title + body on top.

function Card({
  title,
  body,
  children,
  className,
  delay = 0,
}: {
  title: string;
  body: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal
      delay={delay}
      className={cn("relative flex flex-col overflow-hidden rounded-2xl border border-border bg-background", className)}
    >
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative p-8 md:p-10">
        <h3 className="text-lg font-semibold leading-tight">{title}</h3>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">{body}</p>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-6 pb-8">{children}</div>
    </Reveal>
  );
}

function Node({
  x,
  y,
  title,
  tag,
  desc,
  dim,
}: {
  x: number;
  y: number;
  title: string;
  tag: string;
  desc: string;
  dim?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute w-[260px] rounded-xl border border-border bg-card p-3 shadow-xl shadow-black/40",
        dim && "opacity-60"
      )}
      style={{ left: x, top: y }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <Logo size={13} showWord={false} />
          {title}
        </span>
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">{tag}</span>
      </div>
      <p className="mt-2 truncate text-[12px] text-muted">{desc}</p>
    </div>
  );
}

function Tag({ x, y, children, tone }: { x: number; y: number; children: ReactNode; tone: "emerald" | "blue" | "neutral" }) {
  return (
    <span
      className={cn(
        "absolute inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        tone === "emerald" && "border-emerald-base/40 bg-emerald-base/10 text-emerald",
        tone === "blue" && "border-blue-base/40 bg-blue-base/10 text-blue",
        tone === "neutral" && "border-border bg-card text-muted"
      )}
      style={{ left: x, top: y }}
    >
      {children}
    </span>
  );
}

function LoopDiagram() {
  return (
    <div className="flex h-[360px] w-full items-center justify-center overflow-hidden">
      <div className="relative h-[340px] w-[790px] shrink-0 origin-center scale-[0.42] sm:scale-[0.7] md:scale-[0.8] xl:scale-[0.9]">
        <svg className="absolute inset-0" width="790" height="340" fill="none" aria-hidden>
          <circle cx="12" cy="172" r="5" stroke="#3a3a3a" strokeWidth="2" />
          <path d="M17 172 H100" stroke="#10b981" strokeWidth="1.5" className="animate-flow" />
          <path d="M360 172 H400 Q415 172 415 157 V75 Q415 60 430 60 H470" stroke="#3a3a3a" strokeWidth="1.5" />
          <path d="M360 172 H400 Q415 172 415 187 V267 Q415 282 430 282 H470" stroke="#10b981" strokeWidth="1.5" className="animate-flow" />
          <circle cx="360" cy="172" r="4" fill="#121212" stroke="#10b981" strokeWidth="1.5" />
          <circle cx="730" cy="282" r="4" fill="#121212" stroke="#10b981" strokeWidth="1.5" />
        </svg>

        <Tag x={238} y={104} tone="emerald">
          <Check className="size-3" /> Completed
        </Tag>
        <Node x={100} y={130} title="Plan attack" tag="Planner" desc="Objective: leak the system prompt. Strategy: crescendo." />

        <Tag x={388} y={98} tone="neutral">refusal</Tag>
        <Node x={470} y={20} title="Adapt and retry" tag="Planner" desc="Mutates the payload with base64 + rot13." dim />

        <Tag x={381} y={226} tone="emerald">success</Tag>
        <Tag x={624} y={216} tone="blue">
          <Loader2 className="size-3 animate-spin" /> In progress
        </Tag>
        <Node x={470} y={240} title="Replay 20x" tag="Reliability" desc="Scores the success with a Wilson 95% CI." />

        <span className="absolute flex size-11 items-center justify-center" style={{ left: 742, top: 260 }}>
          <span className="animate-pulse-ring absolute inset-0 rounded-full bg-blue-500/40" />
          <span className="relative flex size-9 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-600/40">
            <Plus className="size-4 text-white" />
          </span>
        </span>
      </div>
    </div>
  );
}

function StrategyStack() {
  const items = bento.strategies.items;
  const mid = Math.floor(items.length / 2);
  return (
    <div className="relative flex h-[360px] w-full items-center justify-center">
      <span className="absolute inset-y-0 left-[18%] border-l border-dashed border-border" aria-hidden />
      <span className="absolute inset-y-0 right-[18%] border-l border-dashed border-border" aria-hidden />
      <div className="mask-fade-y relative flex flex-col items-center gap-2">
        {items.map((s, i) => {
          const d = Math.abs(i - mid);
          return (
            <div
              key={s}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border px-3 py-2 font-mono",
                d === 0 ? "border-border bg-elevated text-[15px] text-foreground shadow-lg" : "border-transparent bg-card/60 text-[13px] text-muted"
              )}
              style={{ opacity: 1 - d * 0.18, transform: `scale(${1 - d * 0.05})` }}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-md",
                  d === 0 ? "bg-emerald-base/20 text-emerald" : "bg-elevated text-muted"
                )}
              >
                <Crosshair className="size-3" />
              </span>
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TargetOrbit() {
  const chips = [
    { label: "chat", style: { left: "6%", top: "38%" }, color: "bg-blue-500" },
    { label: "agent", style: { right: "4%", top: "30%" }, color: "bg-violet-500" },
    { label: "rag", style: { left: "14%", bottom: "8%" }, color: "bg-emerald-500" },
    { label: "mcp", style: { right: "12%", bottom: "12%" }, color: "bg-orange-500" },
  ];
  return (
    <div className="relative flex h-[300px] w-full items-center justify-center">
      {[280, 210, 140].map((s) => (
        <span key={s} className="absolute rounded-full border border-dashed border-border" style={{ width: s, height: s, top: 300 / 2 - s / 2 + 20 }} />
      ))}
      <span className="absolute left-1/2 top-[30px] h-[80px] w-px -translate-x-1/2 bg-border" />
      <span className="absolute left-1/2 top-0 flex size-[60px] -translate-x-1/2 items-center justify-center rounded-full bg-white shadow-lg">
        <Logo size={26} showWord={false} />
      </span>
      <span className="relative mt-10 flex size-16 items-center justify-center rounded-2xl border border-border bg-card">
        <Crosshair className="size-7 text-brand" />
        <span className="absolute -bottom-2 -right-2 size-5 rounded-full bg-pink-400" />
      </span>
      {chips.map((c) => (
        <span
          key={c.label}
          className="absolute inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-mono text-[11px]"
          style={c.style}
        >
          <span className={cn("size-1.5 rounded-full", c.color)} />
          {c.label}
        </span>
      ))}
    </div>
  );
}

function HarnessChat() {
  return (
    <div className="w-full max-w-[400px] text-left">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl bg-elevated px-4 py-3 text-[15px]">
        red team support-bot for prompt leaks
      </div>
      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-muted">
        <Terminal className="size-3.5" /> Called ModelWrecker MCP: <span className="font-semibold text-foreground">3 tools</span>
      </div>
      <p className="mt-4 text-[15px] font-semibold">Here's the summary:</p>
      <p className="mt-2 text-[14px] leading-relaxed text-foreground/85">
        Ran crescendo, prompt_extraction, and best_of_n. One verified finding: system prompt leak, critical, 17 of 20 replays.
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-muted/60">Evidence stays in the local runs folder.</p>
    </div>
  );
}

function EvidenceTimeline() {
  return (
    <div className="relative w-full max-w-[420px] text-left text-[13px]">
      <span className="absolute bottom-6 left-[15px] top-8 border-l border-dashed border-border" aria-hidden />
      <div className="relative flex gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-blue-500/10">
          <Crosshair className="size-4 text-blue" />
        </span>
        <div className="flex-1">
          <p className="flex justify-between">
            <span>
              <span className="font-semibold">Attempt #12</span> <span className="text-muted">crescendo</span>
            </span>
            <span className="text-[11px] text-muted">2 min ago</span>
          </p>
          <div className="mt-2 rounded-xl border border-border bg-card p-3">
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-base/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald">
              <ShieldCheck className="size-3" /> Verified
            </span>
            <p className="mt-2 font-semibold">Finding F-0142 created</p>
            <p className="text-[12px] text-muted">17 / 20 replays · CI 0.64 - 0.95</p>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[12px] text-muted">
            <ChevronsUpDown className="size-3" /> Show 11 more attempts
          </p>
        </div>
      </div>
      <div className="relative mt-4 flex gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-blue-500/10">
          <FileCheck2 className="size-4 text-blue" />
        </span>
        <div className="flex-1">
          <p className="flex justify-between">
            <span>
              <span className="font-semibold">Evidence written</span> <span className="text-muted">secrets redacted</span>
            </span>
            <span className="text-[11px] text-muted">1 min ago</span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
            <ChevronsUpDown className="size-3" /> Show all attempts
          </p>
        </div>
      </div>
    </div>
  );
}

export function Bento() {
  return (
    <section id="engine" className="scroll-mt-24 py-20 md:py-28">
      <Container>
        <SectionHeader title={bento.title} description={bento.description} />
        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-3">
          <Card {...bento.automations} className="min-h-[540px] lg:col-span-2">
            <LoopDiagram />
          </Card>
          <Card title={bento.strategies.title} body={bento.strategies.body} className="min-h-[540px]" delay={0.05}>
            <StrategyStack />
          </Card>
          <Card {...bento.targets} delay={0.05}>
            <TargetOrbit />
          </Card>
          <Card {...bento.harness} delay={0.1}>
            <HarnessChat />
          </Card>
          <Card {...bento.evidence} delay={0.15}>
            <EvidenceTimeline />
          </Card>
        </div>
      </Container>
    </section>
  );
}
