import { useSyncExternalStore } from "react";

const noop = () => () => {};

// False in the build-time prerender and during hydration, true once the page
// runs in the browser. Lets the prerender leave out what only the browser loads.
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
