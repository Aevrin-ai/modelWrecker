import { useCallback, useRef, useState, type PointerEvent } from "react";
import { useLocation } from "react-router";

import { useFocusFirstItem } from "./use-focus-first-item";
import { useHideOnScroll } from "./use-hide-on-scroll";
import { useMenuDismiss } from "./use-menu-dismiss";
import { useScrollLock } from "./use-scroll-lock";

// leaving the island waits this long, so a pointer cutting a corner into the panel does not shut it
const HOVER_CLOSE_DELAY_MS = 160;

export function useNavMenu() {
  const location = useLocation();
  const island = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  const { hidden, scrolled } = useHideOnScroll(open !== null);

  // anything that moves to another page or section closes the menu behind it
  const here = location.pathname + location.hash;
  const [lastPath, setLastPath] = useState(here);
  if (here !== lastPath) {
    setLastPath(here);
    setOpen(null);
  }

  const close = useCallback(() => setOpen(null), []);

  const requestFocusFirst = useFocusFirstItem(open);
  useMenuDismiss(open, island, setOpen);
  useScrollLock(open);

  const toggleMenu = (id: string) => setOpen((current) => (current === id ? null : id));
  const openWithKeyboard = (id: string) => {
    requestFocusFirst();
    setOpen(id);
  };
  const hoverOpen = (id: string) => (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const hoverLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || open === "mobile") return;
    closeTimer.current = setTimeout(() => setOpen(null), HOVER_CLOSE_DELAY_MS);
  };
  const hoverStay = () => clearTimeout(closeTimer.current);

  return { island, open, close, toggleMenu, openWithKeyboard, hoverOpen, hoverLeave, hoverStay, hidden, scrolled };
}
