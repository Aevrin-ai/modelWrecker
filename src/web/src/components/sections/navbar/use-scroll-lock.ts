import { useEffect } from "react";

// the phone menu locks the page behind it
export function useScrollLock(openMenu: string | null) {
  useEffect(() => {
    if (openMenu !== "mobile") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openMenu]);
}
