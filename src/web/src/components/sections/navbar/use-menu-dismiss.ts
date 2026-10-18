import { useEffect, type RefObject } from "react";

// escape and a click anywhere outside the island close the open menu
export function useMenuDismiss(
  openMenu: string | null,
  island: RefObject<HTMLDivElement | null>,
  setOpenMenu: (menu: string | null) => void,
) {
  useEffect(() => {
    if (!openMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpenMenu(null);
    const handlePointerDown = (event: PointerEvent) => !island.current?.contains(event.target as Node) && setOpenMenu(null);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenu, island, setOpenMenu]);
}
