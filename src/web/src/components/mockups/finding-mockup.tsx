import { useRef } from "react";

import { cn } from "@/lib/utils";
import { useAutoplay } from "@/hooks/use-autoplay";
import { Download, RefreshCircle } from "@/components/ui/solar-icons";
import { AppCard, Cursor, SeverityTag, Tag } from "./kit";
import { AttemptList } from "./attempt-list";
import { useAnchorPoint } from "./use-anchor-point";

// 0 the report, 1 the pointer moves to an attempt, 2 the click, 3 the attempt open with its proof, held
const DURATIONS = [1.6, 0.9, 0.45, 3.4];
const MOVE = 1;
const PRESS = 2;
const OPEN = 3;

export interface FindingMockupProps {
  className?: string;
}

// the hero's finding card, live: a pointer opens one attempt to unfold its prompt and reply (harmless sample data)
export function FindingMockup({ className }: FindingMockupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const { phase } = useAutoplay(ref, DURATIONS);
  const target = useAnchorPoint(ref, titleRef, phase >= MOVE);
  const open = phase >= OPEN;

  return (
    <AppCard
      className={cn("mx-auto w-full max-w-[600px]", className)}
      label="A finding report for 'System prompt leaked', rated High, with an OWASP-style category, 70% reliability, and one attempt opened to show the exact prompt sent and the reply received."
    >
      <div ref={ref} className="relative">
        {/* what the finding is, and how sure we are */}
        <div className="border-b border-slate-900/[0.08] px-5 pt-6 pb-5 sm:px-7 dark:border-white/[0.08]">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityTag level="High" />
            <Tag tone="info">
              OWASP-style: LLM07<span className="max-sm:hidden">&nbsp;System prompt leakage</span>
            </Tag>
          </div>
          <p className="mt-3 text-[21px] font-semibold tracking-tight">System prompt leaked</p>
          <dl className="mt-4 grid gap-4 text-[15px] sm:grid-cols-2 sm:gap-6">
            <div>
              <dt className="text-[13px] text-slate-500 dark:text-slate-400">Strategy</dt>
              <dd className="mt-0.5 font-medium">Prompt extraction</dd>
            </div>
            <div>
              <dt className="text-[13px] text-slate-500 dark:text-slate-400">Reliability, 7 of 10 replays</dt>
              <dd className="mt-0.5 font-medium tabular-nums">70%, likely 40% to 89%</dd>
              {/* the rate as a dot, the likely range as a band behind it */}
              <div className="relative mt-2 h-2 rounded-full bg-slate-100 dark:bg-white/10">
                <span className="bg-high/25 absolute inset-y-0 left-[40%] w-[49%] rounded-full" />
                <span className="bg-high absolute top-1/2 left-[70%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-slate-900" />
              </div>
            </div>
          </dl>
        </div>

        {/* every try, with its result; one opens to show its proof */}
        <div className="px-5 pt-4 pb-2 sm:px-7">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Attempts</span>
            <span className="text-[13px] text-slate-500 tabular-nums dark:text-slate-400">3 tries</span>
          </div>
          <div className="mt-1 grid">
            <AttemptList open className="invisible col-start-1 row-start-1" />
            <AttemptList
              open={open}
              pressed={phase === PRESS}
              animated
              titleRef={titleRef}
              className="col-start-1 row-start-1 self-start"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-900/[0.08] px-5 py-4 sm:px-7 dark:border-white/[0.08]">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/10 px-3 py-1.5 text-[14px] font-medium dark:border-white/15">
            <RefreshCircle className="size-4" />
            Replay
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-1.5 text-[14px] font-medium text-white dark:bg-white dark:text-slate-950">
            <Download className="size-4" />
            Download report
          </span>
        </div>

        {/* rests near the buttons, travels to the attempt, clicks it, then steps out of the way of the proof */}
        <Cursor
          x={phase >= MOVE && target ? target.x : 78}
          y={phase >= MOVE && target ? target.y : 92}
          pressed={phase === PRESS}
          visible={phase >= MOVE && phase <= PRESS}
        />
      </div>
    </AppCard>
  );
}
