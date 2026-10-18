import type { PointerEvent } from "react";
import { Link } from "react-router";

import { cn } from "@/lib/utils";
import { barLinks, menus } from "@/data/nav";
import { AltArrowDownLine } from "@/components/ui/solar-icons";
import { NAV_TRIGGER_CLASS, isExternalHref } from "./nav-helpers";

export interface DesktopMenuProps {
  openMenu: string | null;
  onHoverOpen: (id: string) => (event: PointerEvent) => void;
  onToggle: (id: string) => void;
  onKeyboardOpen: (id: string) => void;
  onClose: () => void;
}

export function DesktopMenu({ openMenu, onHoverOpen, onToggle, onKeyboardOpen, onClose }: DesktopMenuProps) {
  return (
    <ul className="hidden items-center gap-1 justify-self-center lg:flex">
      {menus.map((menu) => (
        <li key={menu.id}>
          <button
            type="button"
            aria-expanded={openMenu === menu.id}
            aria-controls="nav-panel"
            onPointerEnter={onHoverOpen(menu.id)}
            onClick={() => onToggle(menu.id)}
            onKeyDown={(event) => {
              // the down arrow opens the menu and moves into it, so the keyboard skips the rest of the bar
              if (event.key !== "ArrowDown") return;
              event.preventDefault();
              onKeyboardOpen(menu.id);
            }}
            className={cn(NAV_TRIGGER_CLASS, openMenu === menu.id && "bg-slate-950/[0.05] dark:bg-white/10")}
          >
            {menu.label}
            <AltArrowDownLine
              className={cn("-mr-0.5 size-4 transition-transform duration-200 ease-out", openMenu === menu.id && "rotate-180")}
            />
          </button>
        </li>
      ))}
      {barLinks.map((link) => (
        <li key={link.href}>
          {isExternalHref(link.href) ? (
            <a href={link.href} target="_blank" rel="noreferrer" className={NAV_TRIGGER_CLASS} onPointerEnter={onClose}>
              {link.label}
            </a>
          ) : (
            <Link to={link.href} className={NAV_TRIGGER_CLASS} onPointerEnter={onClose}>
              {link.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
