import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "brand" | "link";
type Size = "sm" | "default" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  brand: "bg-brand text-brand-foreground hover:bg-brand/90",
  link: "text-brand underline-offset-4 hover:underline",
};

const sizes: Record<Size, string> = {
  sm: "h-8 rounded-md px-3 text-xs",
  default: "h-9 rounded-md px-4 text-sm",
  lg: "h-10 rounded-md px-6 text-sm",
  icon: "h-9 w-9 rounded-md",
};

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

/** Share the button look with non-button elements (e.g. a react-router Link). */
export function buttonClasses(variant: Variant = "default", size: Size = "default", className?: string) {
  return cn(BASE, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => (
    <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  ),
);
Button.displayName = "Button";
