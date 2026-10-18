import { cn } from "@/lib/utils";
import { RefreshCircle, ShieldWarning } from "@/components/ui/solar-icons";
import { Appear, SeverityTag, Tag } from "./kit";
import { FINDING, JUDGE, PLAN, REPLAY } from "./run-phases";
import { RunAttempts } from "./run-attempts";

const COMMAND = "modelwrecker run campaign.yaml";
const PICKS = ["crescendo", "PAIR", "prompt extraction"];

export interface RunTerminalViewProps {
  phase: number;
  command: number;
  send: number;
  replay: number;
  isReducedMotion: boolean | null;
}

// the terminal: the command, the planner's picks, the attempts, the replays, and the finding
export function RunTerminalView({ phase, command, send, replay, isReducedMotion }: RunTerminalViewProps) {
  const replayed = Math.max(1, Math.round(replay * 10));
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <p className="truncate font-mono text-[14px] sm:text-[15px]">
        <span className="text-slate-400 select-none dark:text-slate-500">$ </span>
        {COMMAND.slice(0, Math.round(command * COMMAND.length))}
        {phase === PLAN && command < 1 && (
          <span className="ml-px inline-block h-[1.1em] w-px translate-y-[0.15em] animate-pulse bg-current" />
        )}
      </p>

      {/* the planner's picks for the one objective */}
      <div className="mt-5">
        <Appear show={phase >= PLAN} delay={0.9}>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Planner picked</p>
        </Appear>
        <div className="mt-2 flex flex-wrap gap-2">
          {PICKS.map((pick, i) => (
            <Appear key={pick} show={phase >= PLAN} delay={1.0 + i * 0.18} className="inline-flex">
              <span className="bg-lime/30 dark:bg-lime/20 dark:text-lime rounded-full px-3 py-1 text-[14px] font-medium text-slate-900">
                {pick}
              </span>
            </Appear>
          ))}
        </div>
      </div>

      <RunAttempts send={send} judged={phase >= JUDGE} isReducedMotion={isReducedMotion} />

      {/* the win, tried again to see how often it really works */}
      <Appear show={phase >= REPLAY} className="mt-4 rounded-xl bg-slate-100 px-4 py-3 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <RefreshCircle
            className={cn(
              "size-5 shrink-0 text-slate-600 dark:text-slate-300",
              phase === REPLAY && replay < 1 && "animate-spin motion-reduce:animate-none",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">Replay the win</span>
          <span className="shrink-0 text-[14px] text-slate-600 tabular-nums dark:text-slate-300">
            {replay < 1 ? `${replayed} of 10` : "7 of 10 worked"}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-slate-900 dark:bg-white" style={{ width: `${replay * 100}%` }} />
        </div>
      </Appear>

      {/* the finding, with room kept for it so nothing moves when it lands */}
      <div className="mt-4 min-h-[124px]">
        <Appear
          show={phase >= FINDING}
          y={28}
          className="rounded-xl border border-slate-900/10 bg-white p-4 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-800"
        >
          <div className="flex items-center gap-2">
            <ShieldWarning className="text-high size-5 shrink-0" />
            <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">New finding</span>
            <SeverityTag level="High" className="ml-auto" />
          </div>
          <p className="mt-2 text-[17px] font-semibold">System prompt leaked</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Tag tone="info">OWASP-style: LLM07</Tag>
            <Tag>prompt extraction</Tag>
            <Tag tone="good">Proof attached</Tag>
          </div>
        </Appear>
      </div>
    </div>
  );
}
