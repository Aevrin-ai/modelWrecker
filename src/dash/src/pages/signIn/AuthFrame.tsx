import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export interface AuthFrameProps {
  children: ReactNode;
}

// the centered frame shared by the sign-in, loading, admin, and configuration screens
export function AuthFrame({ children }: AuthFrameProps) {
  const { theme, toggle } = useTheme();
  return (
    <div className="relative flex min-h-full w-full items-center justify-center overflow-y-auto bg-background px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-12%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-muted/70 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.4] [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle theme"
        className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {theme === "dark" ? <Sun className="size-[1.15rem]" /> : <Moon className="size-[1.15rem]" />}
      </button>
      <div className="relative z-10 w-full max-w-md animate-fade-in">{children}</div>
    </div>
  );
}
