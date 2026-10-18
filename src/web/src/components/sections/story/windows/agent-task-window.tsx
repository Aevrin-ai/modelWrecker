import { cn } from "@/lib/utils";
import { CpuBolt } from "@/components/ui/solar-icons";
import { WindowFrame } from "./window-frame";
import { PlaceholderBar } from "./placeholder-bar";
import { WindowFlag } from "./window-flag";
import { OkMark } from "./ok-mark";

// an agent working through a task, with one tool step nobody has tried to misuse
export function AgentTaskWindow() {
  const steps = [
    { label: "Read the ticket", tool: "read_ticket", done: true },
    { label: "Look up the order", tool: "get_order", done: true },
    { label: "Write a reply", tool: "draft_reply", done: true },
    { label: "Give a refund", tool: "issue_refund", done: false },
  ];
  return (
    <WindowFrame title="Agent task" icon={CpuBolt}>
      <div className="flex-1 p-6">
        <p className="text-[16px] font-semibold">Help customer #2041</p>
        <PlaceholderBar width="44%" className="mt-2" />
        <ul className="mt-5 space-y-2.5">
          {steps.map((step) => (
            <li
              key={step.tool}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3",
                step.done
                  ? "border-slate-900/[0.08] dark:border-white/[0.08]"
                  : "border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10",
              )}
            >
              <span className="text-[15px]">{step.label}</span>
              <span className="font-mono text-[13px] text-slate-500 dark:text-slate-400">{step.tool}</span>
              <span className="ml-auto">{step.done ? <OkMark /> : <WindowFlag>Never tested</WindowFlag>}</span>
            </li>
          ))}
        </ul>
      </div>
    </WindowFrame>
  );
}
