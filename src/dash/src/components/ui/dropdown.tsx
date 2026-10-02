import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DropdownProps {
  /** The trigger element. Receives nothing; wrap your own button. */
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  className?: string;
  /** Width of the panel. */
  panelClassName?: string;
  triggerClassName?: string;
  /** Accessible name for icon-only triggers. */
  label?: string;
}

/**
 * A lightweight popover menu with click-outside and Escape handling. No Radix.
 * Used for the header notifications, user menu, and the project switcher.
 */
export function Dropdown({
  trigger,
  children,
  align = "end",
  className,
  panelClassName,
  triggerClassName,
  label,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", triggerClassName)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-48 origin-top animate-fade-in overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-popover",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

export function DropdownItem({ onClick, className, children }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

const ITEM =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground";

/** A menu item that navigates (a real link, not a button inside a link). */
export function DropdownLinkItem({
  to,
  onClick,
  className,
  children,
}: {
  to: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} role="menuitem" onClick={onClick} className={cn(ITEM, className)}>
      {children}
    </Link>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">{children}</div>;
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-border" />;
}
