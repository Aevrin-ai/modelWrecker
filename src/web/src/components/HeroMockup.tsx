import {
  Bell,
  ChevronDown,
  ChevronsUpDown,
  Command,
  Crosshair,
  FileText,
  FolderClosed,
  Gauge,
  Home,
  LayoutGrid,
  MonitorSmartphone,
  MoreHorizontal,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  ShieldAlert,
  Star,
  Target,
  Workflow,
  Zap,
} from "lucide-react";
import { Logo } from "./Logo";
import { Pill, severityTone, type Tone } from "./Pill";
import { cn } from "../lib/cn";

// Static product window in the Folio hero style. All values are illustrative
// examples of what the engine produces (verified replay rate over 20 replays,
// severity, OWASP mapping), not real customer data.

type Kind = "chat" | "agent" | "rag" | "mcp";
type Sev = keyof typeof severityTone;
type Status = "finding" | "replaying" | "not-repro";

const kindColor: Record<Kind, string> = {
  chat: "bg-blue-500",
  agent: "bg-violet-500",
  rag: "bg-emerald-500",
  mcp: "bg-orange-500",
};

const rows: {
  title: string;
  target: string;
  kind: Kind;
  techniques: string[];
  sev: Sev;
  asr: string;
  status: Status;
}[] = [
  { title: "System prompt leak", target: "support-bot", kind: "chat", techniques: ["crescendo", "prompt_extraction"], sev: "critical", asr: "0.85", status: "finding" },
  { title: "Forbidden tool call", target: "ops-agent", kind: "agent", techniques: ["tool_misuse"], sev: "high", asr: "0.70", status: "finding" },
  { title: "Indirect doc injection", target: "kb-rag", kind: "rag", techniques: ["rag_injection", "LLM01"], sev: "high", asr: "0.65", status: "finding" },
  { title: "Tool description poisoning", target: "mcp-gateway", kind: "mcp", techniques: ["mcp_tool_poisoning"], sev: "medium", asr: "0.40", status: "replaying" },
  { title: "PAIR refinement", target: "billing-bot", kind: "chat", techniques: ["pyrit_pair"], sev: "high", asr: "0.60", status: "finding" },
  { title: "Encoded jailbreak", target: "support-bot", kind: "chat", techniques: ["encoded_jailbreak", "base64"], sev: "medium", asr: "0.35", status: "finding" },
  { title: "TAP branch escape", target: "billing-bot", kind: "chat", techniques: ["pyrit_tap"], sev: "medium", asr: "0.45", status: "replaying" },
  { title: "Best-of-N variant", target: "ops-agent", kind: "agent", techniques: ["best_of_n", "leetspeak"], sev: "medium", asr: "0.40", status: "finding" },
  { title: "Many-shot override", target: "support-bot", kind: "chat", techniques: ["many_shot"], sev: "low", asr: "0.15", status: "not-repro" },
  { title: "Prefill continuation", target: "support-bot", kind: "chat", techniques: ["prefill"], sev: "low", asr: "0.20", status: "finding" },
  { title: "garak probe hit", target: "kb-rag", kind: "rag", techniques: ["garak_probe"], sev: "low", asr: "0.10", status: "not-repro" },
  { title: "Homoglyph bypass", target: "mcp-gateway", kind: "mcp", techniques: ["homoglyph", "encoded_jailbreak"], sev: "low", asr: "0.20", status: "replaying" },
  { title: "Zero-width smuggle", target: "kb-rag", kind: "rag", techniques: ["zero_width"], sev: "medium", asr: "0.30", status: "finding" },
];

const asrTone = (v: string): Tone => {
  const n = Number(v);
  if (n >= 0.6) return "red";
  if (n >= 0.35) return "amber";
  if (n >= 0.2) return "purple";
  return "emerald";
};

function StatusCell({ s }: { s: Status }) {
  if (s === "replaying")
    return (
      <span className="inline-flex items-center gap-1.5 text-blue">
        <Zap className="size-3.5" /> Replaying
      </span>
    );
  if (s === "finding")
    return (
      <span className="inline-flex items-center gap-1.5 text-foreground/90">
        <span className="size-2 rounded-full bg-emerald-400" /> Finding
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="size-2 rounded-full bg-faint" /> Not reproducible
    </span>
  );
}

const nav = [
  { icon: Home, label: "Overview", active: true },
  { icon: Bell, label: "Notifications" },
  { icon: Crosshair, label: "Campaigns" },
  { icon: ShieldAlert, label: "Findings" },
  { icon: Target, label: "Targets" },
  { icon: MonitorSmartphone, label: "Devices" },
  { icon: Gauge, label: "Analytics" },
];

export function HeroMockup() {
  return (
    <div
      aria-hidden
      className="relative mx-auto flex h-[520px] overflow-hidden rounded-xl border border-border bg-background/95 text-[13px] shadow-2xl shadow-black/60 ring-1 ring-black/40 md:h-[720px] lg:text-sm"
    >
      {/* Sidebar */}
      <aside className="hidden w-[270px] shrink-0 flex-col border-r border-border bg-card/95 lg:flex">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="flex items-center gap-1.5">
            <Logo size={20} wordClassName="text-[15px]" />
            <ChevronDown className="size-3.5 text-muted" />
          </span>
          <PanelLeft className="size-4 text-muted" />
        </div>
        <div className="flex gap-1.5 px-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
            <Command className="size-3.5 text-muted" />
            <span className="font-medium">Quick actions</span>
            <span className="ml-auto text-xs text-muted">Ctrl K</span>
          </div>
          <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2">
            <Search className="size-3.5" />
            <span className="text-muted">/</span>
          </div>
        </div>
        <ul className="mt-2 space-y-0.5 px-3">
          {nav.map((n) => (
            <li
              key={n.label}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5",
                n.active ? "bg-elevated font-medium text-foreground" : "text-foreground/85"
              )}
            >
              <n.icon className="size-4 text-muted" />
              {n.label}
            </li>
          ))}
          <li className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-foreground/85">
            <Workflow className="size-4 text-muted" />
            Reports
            <ChevronDown className="size-3.5 text-muted" />
          </li>
          <li className="flex items-center gap-2.5 py-1.5 pl-7 text-foreground/85">
            <LayoutGrid className="size-3.5 text-muted" /> ASR report
          </li>
          <li className="flex items-center gap-2.5 py-1.5 pl-7 text-foreground/85">
            <LayoutGrid className="size-3.5 text-muted" /> Model leaderboard
          </li>
        </ul>
        <div className="mt-4 px-5 text-xs text-muted">
          <ChevronDown className="mr-1 inline size-3" /> Projects
        </div>
        <ul className="mt-1.5 space-y-0.5 px-3">
          <li className="flex items-center gap-2.5 px-2 py-1.5 font-medium">
            <FolderClosed className="size-4 text-muted" /> acme-support
          </li>
          <li className="flex items-center gap-2.5 py-1.5 pl-7 text-foreground/85">
            <FileText className="size-3.5 text-muted" /> Prompt extraction sweep
          </li>
          <li className="flex items-center gap-2.5 py-1.5 pl-7 text-foreground/85">
            <FileText className="size-3.5 text-muted" /> Agent tool misuse
          </li>
          <li className="flex items-center gap-2.5 px-2 py-1.5 font-medium">
            <FolderClosed className="size-4 text-muted" /> knowledge-base
          </li>
          <li className="flex items-center gap-2.5 py-1.5 pl-7 text-foreground/50">
            <FileText className="size-3.5" /> RAG injection
          </li>
        </ul>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2 font-semibold">
            Prompt extraction sweep <Star className="size-4 fill-muted text-muted" />
          </div>
          <div className="flex items-center gap-4 text-muted">
            <Plus className="size-4" />
            <PanelRight className="size-4" />
            <MoreVertical className="size-4" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-1.5 text-[15px] font-semibold">
            Attack results <ChevronDown className="size-4 text-muted" />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border border-border px-2.5 py-1 text-xs font-medium sm:inline">
              Replay 20x
            </span>
            <span className="rounded-md border border-border px-2.5 py-1 text-xs font-medium">Export CSV</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-5 py-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2 py-1 text-xs font-medium">
            <ChevronsUpDown className="size-3.5" /> Sorted by severity
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-elevated px-2 py-1 text-xs font-medium">
            Target filter 4 <MoreHorizontal className="size-3.5" />
          </span>
          <span className="inline-flex size-6 items-center justify-center rounded-md border border-border">
            <Plus className="size-3.5 text-muted" />
          </span>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-hidden">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="w-10 py-2 pl-5 font-normal">
                  <span className="block size-3.5 rounded border border-border" />
                </th>
                <th className="border-r border-border py-2 pl-1 pr-3 font-normal">Finding</th>
                <th className="border-r border-border px-3 py-2 font-normal">Target</th>
                <th className="border-r border-border px-3 py-2 font-normal">Techniques</th>
                <th className="border-r border-border px-3 py-2 font-normal">
                  Severity <span className="ml-1 rounded bg-elevated px-1 text-[10px]">judge</span>
                </th>
                <th className="border-r border-border px-3 py-2 font-normal">
                  ASR <span className="ml-1 rounded bg-elevated px-1 text-[10px]">replay</span>
                </th>
                <th className="px-3 py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.title} className="border-b border-border/80">
                  <td className="py-2.5 pl-5">
                    <span className="block size-3.5 rounded border border-border" />
                  </td>
                  <td className="border-r border-border py-2.5 pl-1 pr-3">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded text-[9px] font-bold text-white",
                          kindColor[r.kind]
                        )}
                      >
                        {r.kind[0].toUpperCase()}
                      </span>
                      <span className="truncate">{r.title}</span>
                    </span>
                  </td>
                  <td className="border-r border-border px-3 py-2.5">
                    <Pill tone="blue" className="bg-transparent">
                      {r.target}
                    </Pill>
                  </td>
                  <td className="border-r border-border px-3 py-2.5">
                    <span className="flex gap-1.5">
                      {r.techniques.map((t) => (
                        <span key={t} className="rounded-md bg-elevated px-2 py-1 text-xs font-medium">
                          {t}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="border-r border-border px-3 py-2.5">
                    <Pill tone={severityTone[r.sev]} className="capitalize">
                      {r.sev}
                    </Pill>
                  </td>
                  <td className="border-r border-border px-3 py-2.5">
                    <Pill tone={asrTone(r.asr)}>{r.asr}</Pill>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    <StatusCell s={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
