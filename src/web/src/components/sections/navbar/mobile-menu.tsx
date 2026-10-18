import { Link } from "react-router";

import { APP_URL, DEMO_URL } from "@/lib/links";
import type { Theme } from "@/hooks/use-theme";
import { barLinks, menus } from "@/data/nav";
import { Pill } from "@/components/ui/pill";
import { Moon, Sun } from "@/components/ui/solar-icons";
import { MobileSection } from "./mobile-section";
import { isExternalHref } from "./nav-helpers";

export interface MobileMenuProps {
  onClose: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

export function MobileMenu({ onClose, theme, onToggleTheme }: MobileMenuProps) {
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  return (
    <div className="max-h-[calc(100svh-120px)] overflow-y-auto">
      {menus.map((menu) => (
        <MobileSection key={menu.id} label={menu.label} columns={menu.columns} onDone={onClose} />
      ))}
      <div className="mt-2 flex flex-col gap-1 border-t border-slate-950/[0.08] pt-4 dark:border-white/10">
        {barLinks.map((link) =>
          isExternalHref(link.href) ? (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="text-foreground px-1 py-2 text-base font-medium">
              {link.label}
            </a>
          ) : (
            <Link key={link.href} to={link.href} onClick={onClose} className="text-foreground px-1 py-2 text-base font-medium">
              {link.label}
            </Link>
          ),
        )}
        <div className="mt-3 flex flex-col gap-2">
          <Pill href={DEMO_URL} className="w-full">
            Request a demo
          </Pill>
          <Pill variant="outline" href={APP_URL} className="w-full">
            Open modelWrecker
          </Pill>
          <Pill variant="soft" onClick={onToggleTheme} className="w-full">
            <ThemeIcon />
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Pill>
        </div>
      </div>
    </div>
  );
}
