import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * A small accessible modal (no Radix): overlay click and Escape close it, focus moves
 * into the panel on open and returns to the opener on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      "input, select, textarea, button:not([data-dialog-close])",
    );
    (first ?? panel.current)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRef.current();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-lg border bg-background shadow-popover animate-fade-in focus:outline-none sm:rounded-lg",
          className,
        )}
      >
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 id={titleId} className="text-lg font-semibold leading-none tracking-tight">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-dialog-close
            onClick={onClose}
            className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-2">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 p-6 pt-4 sm:flex-row sm:justify-end">{footer}</div>
        )}
      </div>
    </div>
  );
}
