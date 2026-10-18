import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

// follows the system until the toggle is used; index.html sets the class before first paint so nothing flashes
const KEY = "mw-theme";
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function saveTheme(theme: Theme): boolean {
  try {
    localStorage.setItem(KEY, theme);
    return true;
  } catch {
    // private windows can refuse storage; the toggle still works for this visit
    return false;
  }
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
    saveTheme(next);
    listeners.forEach((listener) => listener());
  }, []);

  return { theme, toggle };
}
