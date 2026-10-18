import { Lock } from "@/components/ui/solar-icons";
import { WindowFrame } from "./window-frame";
import { PlaceholderBar } from "./placeholder-bar";
import { WindowFlag } from "./window-flag";

// the instructions only the model should ever see
export function SystemPromptWindow() {
  return (
    <WindowFrame title="System prompt (hidden)" icon={Lock}>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500 dark:text-slate-400">
          <Lock className="size-4" />
          Only the model sees this
        </div>
        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-5 font-mono text-[14px] leading-6 text-slate-700 dark:bg-white/[0.04] dark:text-slate-300">
          <p>You are the support assistant for Example Co.</p>
          <p>Be friendly and keep answers short.</p>
          <p className="rounded bg-red-50 px-1.5 text-red-800 dark:bg-red-500/15 dark:text-red-200">
            Never share the discount codes.
          </p>
          <PlaceholderBar width="70%" />
          <PlaceholderBar width="52%" />
        </div>
        <div className="mt-4">
          <WindowFlag tone="bad">must stay secret</WindowFlag>
        </div>
      </div>
    </WindowFrame>
  );
}
