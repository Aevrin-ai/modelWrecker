import { APP_URL, DEMO_URL } from "@/lib/links";
import type { Theme } from "@/hooks/use-theme";
import { Pill } from "@/components/ui/pill";
import { AltArrowRightLine, CloseCircleLine, HamburgerMenuLine, Moon, Sun } from "@/components/ui/solar-icons";

export interface NavActionsProps {
  theme: Theme;
  onToggleTheme: () => void;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
}

export function NavActions({ theme, onToggleTheme, isMobileOpen, onToggleMobile }: NavActionsProps) {
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  return (
    <div className="flex items-center gap-2 justify-self-end">
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="text-foreground focus-visible:ring-ring hidden size-9 items-center justify-center rounded-full transition-colors outline-none hover:bg-slate-950/[0.06] focus-visible:ring-2 lg:flex dark:hover:bg-white/10"
      >
        <ThemeIcon className="size-[18px]" />
      </button>
      <Pill variant="outline" size="sm" href={APP_URL} className="hidden md:inline-flex">
        Open modelWrecker
      </Pill>
      <Pill size="sm" href={DEMO_URL} className="hidden pr-3 sm:inline-flex">
        Request a demo
        <AltArrowRightLine className="-mr-1 transition-transform group-hover:translate-x-0.5" />
      </Pill>
      <button
        type="button"
        aria-expanded={isMobileOpen}
        aria-controls="nav-panel"
        aria-label={isMobileOpen ? "Close menu" : "Open menu"}
        onClick={onToggleMobile}
        className="text-foreground focus-visible:ring-ring flex size-10 items-center justify-center rounded-full outline-none hover:bg-slate-950/[0.06] focus-visible:ring-2 lg:hidden dark:hover:bg-white/10"
      >
        {isMobileOpen ? <CloseCircleLine className="size-6" /> : <HamburgerMenuLine className="size-5" />}
      </button>
    </div>
  );
}
