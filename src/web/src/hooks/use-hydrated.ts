import { useSyncExternalStore } from "react";

const noop = () => () => {};

// false in the prerender and during hydration, true in the browser, so the prerender can leave out browser-only parts
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
