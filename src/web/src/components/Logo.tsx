import { cn } from "../lib/cn";

// The real Aevrin mark (downloaded from aevrin.net) plus the wordmark.
export function Logo({
  className,
  size = 24,
  showWord = true,
  wordClassName,
}: {
  className?: string;
  size?: number;
  showWord?: boolean;
  wordClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src="/aevrin-logo.png"
        alt={showWord ? "" : "Aevrin"}
        width={size}
        height={Math.round(size * 1.1)}
        style={{ width: size, height: "auto" }}
        className="shrink-0"
      />
      {showWord && (
        <span className={cn("font-semibold tracking-tight text-foreground", wordClassName)}>Aevrin</span>
      )}
    </span>
  );
}
