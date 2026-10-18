export interface TranscriptTextProps {
  label: string;
  text: string;
  isReply?: boolean;
}

export function TranscriptText({ label, text, isReply }: TranscriptTextProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <pre
        className={`max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-xs ${
          isReply ? "bg-brand-muted/40" : "bg-muted"
        }`}
      >
        {text || "(empty)"}
      </pre>
    </div>
  );
}
