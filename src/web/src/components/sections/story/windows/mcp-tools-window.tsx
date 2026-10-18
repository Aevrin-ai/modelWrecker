import { cn } from "@/lib/utils";
import { PlugCircleLine } from "@/components/ui/solar-icons";
import { WindowFrame } from "./window-frame";
import { WindowSidebar } from "./window-sidebar";
import { WindowFlag } from "./window-flag";
import { OkMark } from "./ok-mark";

// the tools plugged into an AI through MCP; one description changed overnight
export function McpToolsWindow() {
  const tools = [
    { name: "search_docs", note: "Search the help center" },
    { name: "read_calendar", note: "See free times" },
    { name: "send_email", note: "Send an email", changed: true },
    { name: "create_ticket", note: "Open a support ticket" },
  ];
  return (
    <WindowFrame title="MCP tools" icon={PlugCircleLine}>
      <WindowSidebar items={["Tools", "Servers", "Logs"]} />
      <div className="flex-1 p-6">
        <p className="text-[16px] font-semibold">4 tools connected</p>
        <ul className="mt-4 space-y-2.5">
          {tools.map((tool) => (
            <li
              key={tool.name}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-2.5",
                tool.changed
                  ? "border-amber-200 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10"
                  : "border-slate-900/[0.08] dark:border-white/[0.08]",
              )}
            >
              <span className="min-w-0">
                <span className="block font-mono text-[14px]">{tool.name}</span>
                <span className="block text-[13px] text-slate-500 dark:text-slate-400">{tool.note}</span>
              </span>
              <span className="ml-auto">{tool.changed ? <WindowFlag>description changed</WindowFlag> : <OkMark />}</span>
            </li>
          ))}
        </ul>
      </div>
    </WindowFrame>
  );
}
