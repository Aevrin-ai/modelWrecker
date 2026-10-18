import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { useTyping } from "@/hooks/use-typing";
import { DocumentText, Programming } from "@/components/ui/solar-icons";
import { AppCard, View, WindowDots } from "./kit";
import { CAMPAIGN, PLAN, REPLAY, SEND, getPartProgress } from "./run-phases";
import { RunCampaignView } from "./run-campaign-view";
import { RunTerminalView } from "./run-terminal-view";
import { WindowTab } from "./window-tab";

export interface RunMockupProps {
  phase: number;
  live: boolean;
  className?: string;
}

// one run in one window; the section owns the phase so the step list and this picture always agree
export function RunMockup({ phase, live, className }: RunMockupProps) {
  const reduce = useReducedMotion();
  const yamlTyped = useTyping(phase === CAMPAIGN && live, 3.2);
  const commandTyped = useTyping(phase === PLAN && live, 0.8);
  const sendTyped = useTyping(phase === SEND && live, 2.2);
  const replayTyped = useTyping(phase === REPLAY && live, 2.2);

  const yaml = getPartProgress(phase, CAMPAIGN, yamlTyped, reduce);
  const command = getPartProgress(phase, PLAN, commandTyped, reduce);
  const send = getPartProgress(phase, SEND, sendTyped, reduce);
  const replay = getPartProgress(phase, REPLAY, replayTyped, reduce);

  return (
    <AppCard
      className={cn("mx-auto w-full max-w-[600px]", className)}
      label="A modelWrecker run: a short YAML campaign is written, the planner picks crescendo, PAIR and prompt extraction, the judge marks one attempt as worked, the win is replayed 10 times, and a High finding, System prompt leaked, is written."
    >
      <div className="flex h-12 items-center gap-3 border-b border-slate-900/[0.08] bg-slate-50 px-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <WindowDots className="text-[11px]" />
        <div className="flex gap-1">
          <WindowTab active={phase === CAMPAIGN} icon={DocumentText}>
            campaign.yaml
          </WindowTab>
          <WindowTab active={phase >= PLAN} icon={Programming}>
            Terminal
          </WindowTab>
        </div>
      </div>

      <div className="grid">
        <View show={phase === CAMPAIGN}>
          <RunCampaignView shown={yaml} />
        </View>

        <View show={phase >= PLAN}>
          <RunTerminalView phase={phase} command={command} send={send} replay={replay} isReducedMotion={reduce} />
        </View>
      </div>
    </AppCard>
  );
}
