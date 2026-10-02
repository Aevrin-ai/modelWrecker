import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: "default" | "error";
}

interface ToastContextValue {
  toast: (t: Omit<Toast, "id" | "tone"> & { tone?: Toast["tone"] }) => void;
}

const Ctx = createContext<ToastContextValue | null>(null);
let nextId = 1;

/** Small bottom-right toasts for action feedback (saved, marked ready, revoked). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const toast = useCallback<ToastContextValue["toast"]>(
    (t) => {
      const id = nextId++;
      setItems((xs) => [...xs.slice(-2), { id, tone: "default", ...t }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-0 right-0 z-[70] flex w-full flex-col gap-2 p-4 sm:max-w-sm"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-md border bg-background p-4 shadow-popover animate-fade-in",
              t.tone === "error" && "border-destructive/40",
            )}
          >
            {t.tone === "error" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
