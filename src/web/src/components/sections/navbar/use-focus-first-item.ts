import { useEffect, useRef } from "react";

// opened with the down arrow: once the panel is in the page, focus its first item
export function useFocusFirstItem(openMenu: string | null) {
  const focusFirst = useRef(false);
  useEffect(() => {
    if (!focusFirst.current || !openMenu) return;
    focusFirst.current = false;
    document.querySelector<HTMLElement>("#nav-panel a")?.focus();
  }, [openMenu]);

  return () => {
    focusFirst.current = true;
  };
}
