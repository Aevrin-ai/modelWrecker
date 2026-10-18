import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandBlockProps {
  command: string;
  label?: string;
  className?: string;
}

// display only: the dashboard never runs a command, and shows only documented ones (docs/reference/CLI.md)
export function CommandBlock({ command, label, className }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be blocked; the text is still selectable, so nothing else is needed
      return;
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className="group relative rounded-md border bg-muted/50">
        <pre className="overflow-x-auto whitespace-pre p-3 pr-12 font-mono text-xs leading-relaxed text-foreground">
          {command}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:text-foreground"
          aria-label={copied ? "Copied" : "Copy command"}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
