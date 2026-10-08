/*
  API entry point and the mock -> real swap point.

  VITE_API_MODE=http selects HttpApiClient (the real control-plane API, with Google sign-in).
  Anything else, including unset, keeps MockApiClient so local dev and the demo work with no
  backend. The mode is fixed at build time (src/lib/config.ts). Nothing else in the UI changes.

  The mock client and src/data/mock load with a dynamic import, and only in mock mode. IS_HTTP_MODE
  is a build-time constant, so an http-mode build drops that branch and ships no mock data.
*/

import type { ApiClient } from "./client";
import { HttpApiClient } from "./httpClient";
import { API_BASE, IS_HTTP_MODE } from "@/lib/config";

type AnyMethod = (...args: unknown[]) => Promise<unknown>;

/** An ApiClient whose every method waits for the mock module, then forwards the call. */
function lazyMockClient(): ApiClient {
  let loaded: Promise<ApiClient> | null = null;
  const load = () => (loaded ??= import("./mockClient").then((m) => new m.MockApiClient()));
  return new Proxy({} as ApiClient, {
    get(_target, prop) {
      // Not a thenable, so `await apiClient` never hangs on the proxy.
      if (prop === "then" || typeof prop === "symbol") return undefined;
      return (...args: unknown[]) =>
        load().then((client) => (client as unknown as Record<string, AnyMethod>)[prop](...args));
    },
  });
}

// The single place the active backend is chosen.
export const apiClient: ApiClient = IS_HTTP_MODE ? new HttpApiClient(API_BASE) : lazyMockClient();

export { ApiError } from "./httpClient";
