import { useRef } from "react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import { DangerTriangle, DocumentText, Letter } from "@/components/ui/solar-icons";
import { Done, Panel, Row, Status, Tile } from "../kit";
import { THREE_ROWS } from "./timings";
import { Turn } from "./turn";

const AGENT_STEPS = [
  { tool: "read_inbox", sub: "Reads 12 emails", icon: Letter },
  { tool: "write_summary", sub: "Writes the summary", icon: DocumentText },
  { tool: "delete_files", sub: "Asked for by a line in an email", icon: DangerTriangle, flagged: true },
] as const;

export function AgentPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase } = useAutoplay(ref, THREE_ROWS);
  return (
    <div ref={ref} className="h-full">
      <Panel
        title="Agent task"
        meta="Sum up my inbox"
        label="An agent sums up an inbox: two tool calls are fine, and a call to delete files, asked for by a line in an email, is flagged."
      >
        {AGENT_STEPS.map((step, i) => {
          const flagged = "flagged" in step && phase > i;
          return (
            <Row
              key={step.tool}
              highlight={flagged}
              tile={
                <Tile
                  icon={step.icon}
                  className={cn(flagged && "bg-red-50 dark:bg-red-500/15")}
                  iconClassName={cn(flagged && "text-red-600 dark:text-red-300")}
                />
              }
              title={<span className="font-mono text-[15px]">{step.tool}</span>}
              sub={step.sub}
              right={
                <Turn phase={phase} index={i}>
                  {"flagged" in step ? <Status tone="bad">Flagged</Status> : <Done />}
                </Turn>
              }
            />
          );
        })}
      </Panel>
    </div>
  );
}
