type YamlLine = { indent: number; key: string; value?: string };

// a short campaign with only real campaign keys: each role on its own model, one objective
const YAML: YamlLine[] = [
  { indent: 0, key: "attacker" },
  { indent: 1, key: "model", value: "openai/gpt-4o-mini" },
  { indent: 0, key: "target" },
  { indent: 1, key: "model", value: "openai/gpt-4o-mini" },
  { indent: 1, key: "authorized", value: "true" },
  { indent: 0, key: "judge" },
  { indent: 1, key: "model", value: "openai/gpt-4o-mini" },
  { indent: 0, key: "attack" },
  { indent: 1, key: "strategy", value: "auto" },
  { indent: 0, key: "objectives" },
  { indent: 1, key: "- title", value: "Leak the system prompt" },
  { indent: 2, key: "category", value: "system_prompt_leak" },
];

const LINES = YAML.map((line) => {
  const pad = "  ".repeat(line.indent);
  const head = `${pad}${line.key}:`;
  return { head, text: line.value ? `${head} ${line.value}` : head };
});
// where each line starts in the typed text, counting one newline per line
const STARTS = LINES.reduce<number[]>((acc, _line, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + LINES[i - 1].text.length + 1);
  return acc;
}, []);
const TOTAL = STARTS[STARTS.length - 1] + LINES[LINES.length - 1].text.length;

export interface RunCampaignViewProps {
  shown: number;
}

// the campaign file typing itself, `shown` being how far along it is from 0 to 1
export function RunCampaignView({ shown }: RunCampaignViewProps) {
  const count = Math.round(shown * TOTAL);
  return (
    <div className="px-4 py-5 font-mono text-[14px] leading-6 sm:px-6 sm:py-6 sm:text-[15px] sm:leading-7">
      {LINES.map((line, i) => {
        const visible = Math.max(0, Math.min(line.text.length, count - STARTS[i]));
        const typed = line.text.slice(0, visible);
        const caretHere = shown < 1 && count >= STARTS[i] && count <= STARTS[i] + line.text.length;
        return (
          <div key={i} className="flex gap-4 whitespace-pre">
            <span className="hidden w-5 shrink-0 text-right text-slate-400 select-none sm:inline dark:text-slate-500">{i + 1}</span>
            <span>
              <span className="text-sky-700 dark:text-sky-300">{typed.slice(0, line.head.length)}</span>
              <span className="text-slate-700 dark:text-slate-200">{typed.slice(line.head.length)}</span>
              {caretHere && (
                <span className="ml-px inline-block h-[1.1em] w-px translate-y-[0.15em] animate-pulse bg-current" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
