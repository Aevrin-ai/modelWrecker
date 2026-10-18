

const CODE_TONE_CLASS: Record<"reply" | "cmd" | "plain", string> = {
  reply: "bg-brand-muted/40",
  cmd: "bg-primary text-primary-foreground",
  plain: "bg-muted",
};

export interface CodeBlockProps {
  label: string;
  text: string;
  tone?: "reply" | "cmd";
}

export function CodeBlock({ label, text, tone }: CodeBlockProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        className={`overflow-x-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs ${CODE_TONE_CLASS[tone ?? "plain"]}`}
      >
        {text}
      </pre>
    </div>
  );
}
