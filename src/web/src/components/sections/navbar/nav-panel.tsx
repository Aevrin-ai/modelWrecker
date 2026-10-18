import type { RefObject } from "react";

import type { Theme } from "@/hooks/use-theme";
import type { NavColumn } from "@/data/nav";
import { MenuColumns } from "./menu-columns";
import { MobileMenu } from "./mobile-menu";

export interface NavPanelProps {
  openMenu: string | null;
  shown: string | null;
  menu: { columns: NavColumn[] } | undefined;
  height: number;
  contentsRef: RefObject<HTMLDivElement | null>;
  isReducedMotion: boolean;
  onClose: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

// the panel grows out of the bar: its height eases to fit, and its contents settle in and fade out with it
export function NavPanel(props: NavPanelProps) {
  const { openMenu, shown, menu, height, contentsRef, isReducedMotion, onClose, theme, onToggleTheme } = props;
  return (
    <div
      id="nav-panel"
      inert={!openMenu}
      className="overflow-hidden"
      style={{
        height: openMenu ? height : 0,
        opacity: openMenu ? 1 : 0,
        transition: isReducedMotion ? "none" : "height 380ms var(--ease-smooth), opacity 240ms var(--ease-smooth)",
      }}
    >
      <div ref={contentsRef}>
        {shown && (
          <div key={shown} className="nav-panel-in mx-4 border-t border-slate-950/[0.08] pt-4 pb-6 md:mx-6 dark:border-white/10">
            {shown === "mobile" ? (
              <MobileMenu onClose={onClose} theme={theme} onToggleTheme={onToggleTheme} />
            ) : (
              menu && <MenuColumns columns={menu.columns} onDone={onClose} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
