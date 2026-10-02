import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg" | "pill";

// Folio buttons: 6px radius, 14px/500 Geist, 8px 16px padding. Primary is a
// near-white fill; outline is a faint fill with a #242424 border.
const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border border-border bg-input/30 text-foreground hover:bg-input/60",
  ghost: "text-muted hover:text-foreground",
};

const sizes: Record<Size, string> = {
  sm: "h-8 rounded-md px-3 text-sm",
  md: "h-9 rounded-md px-4 text-sm",
  lg: "h-10 rounded-md px-5 text-[15px]",
  pill: "h-12 rounded-full px-6 text-sm",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-all",
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
