import { CodeSquare } from "@/components/ui/solar-icons";
import { WindowFrame } from "./window-frame";
import { WindowFlag } from "./window-flag";

// an app calling an AI model with code: the message is just data in a body
export function ApiRequestWindow() {
  return (
    <WindowFrame title="API request" icon={CodeSquare}>
      <div className="flex-1 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-emerald-600 px-2.5 py-1 font-mono text-[12px] font-semibold text-white">POST</span>
          <span className="font-mono text-[14px] text-slate-700 dark:text-slate-300">/v1/chat/completions</span>
          <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">200 OK</span>
        </div>
        <pre className="mt-5 rounded-xl bg-slate-50 p-5 font-mono text-[14px] leading-7 text-slate-700 dark:bg-white/[0.04] dark:text-slate-300">
          {"{\n"}
          {'  "model": "support-bot",\n'}
          {'  "messages": [\n'}
          {'    { "role": "user",\n'}
          <span className="rounded bg-amber-100 px-1 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
            {'      "content": "Ignore your rules..."'}
          </span>
          {"\n    }\n  ]\n}"}
        </pre>
        <div className="mt-4">
          <WindowFlag>Anyone can send this</WindowFlag>
        </div>
      </div>
    </WindowFrame>
  );
}
