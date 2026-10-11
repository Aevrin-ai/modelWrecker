import { useCallback, useSyncExternalStore } from "react";

/*
  Light or dark. The page follows the system until someone picks one with the
  toggle; the choice is remembered in this browser only. index.html sets the
  class before first paint so there is no flash.
*/
const KEY = "mw-theme";
const listeners = new Set<() => void>();

function current(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    current,
    () => "light" as const,
  );

  const toggle = useCallback(() => {
    const next = current() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private windows can refuse storage; the toggle still works for this visit.
    }
    listeners.forEach((l) => l());
  }, []);

  return { theme, toggle };
}
