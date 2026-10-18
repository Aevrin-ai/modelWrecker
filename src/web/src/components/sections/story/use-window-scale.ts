import { useSyncExternalStore } from "react";

// laptop size scaled with the screen, never below a size that still reads as a window, and smaller on short screens
function getWindowScale() {
  return Math.min(1.12, Math.max(0.5, Math.min(window.innerWidth / 1440, window.innerHeight / 900)));
}

export function useWindowScale() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    getWindowScale,
    () => 1,
  );
}
