import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Link } from "react-router";

import { cn } from "@/lib/utils";

/*
  Every call to action on the site is a pill. `primary` is the dark one with a
  pressed-in edge, `glass` sits on a painted sky, `soft` and `outline` are the
  quiet second choice on white.
*/
const pillVariants = cva(
  "group inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,color,box-shadow,opacity,scale] duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.35),0_1px_2px_rgba(2,6,23,0.2),0_10px_28px_-10px_rgba(2,6,23,0.6)] hover:bg-primary/90",
        glass:
          "bg-white/70 text-slate-950 backdrop-blur-md hover:bg-white/90 dark:bg-white/10 dark:text-foreground dark:hover:bg-white/15",
        soft: "bg-slate-950/[0.06] text-foreground hover:bg-slate-950/10 dark:bg-white/10 dark:hover:bg-white/15",
        outline: "border border-border bg-background text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-12 px-7 text-base",
        lg: "h-12 px-7 text-base md:h-[50px] md:text-[17px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type PillProps = VariantProps<typeof pillVariants> & {
  className?: string;
  children: ReactNode;
  /** A page of this site. */
  to?: string;
  /** A link off it (opens in a new tab when it is another site). */
  href?: string;
} & Omit<ComponentProps<"button">, "className" | "children">;

export function Pill({ variant, size, className, to, href, children, ...props }: PillProps) {
  const classes = cn(pillVariants({ variant, size }), className);
  if (to) {
    return (
      <Link to={to} className={classes} onClick={props.onClick as ComponentProps<typeof Link>["onClick"]}>
        {children}
      </Link>
    );
  }
  if (href) {
    const external = /^https?:/.test(href) && !href.startsWith("https://app.aevrin.net");
    return (
      <a
        href={href}
        className={classes}
        onClick={props.onClick as ComponentProps<"a">["onClick"]}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
