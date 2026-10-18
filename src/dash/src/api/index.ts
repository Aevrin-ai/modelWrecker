// API entry point: the one place the mock or the real control-plane client is chosen

import type { ApiClient } from "./client";
import { HttpApiClient } from "./httpClient";
import { API_BASE, IS_HTTP_MODE } from "@/lib/config";

type AnyMethod = (...args: unknown[]) => Promise<unknown>;

// the mock loads with a dynamic import, so an http-mode build drops it and ships no mock data
function lazyMockClient(): ApiClient {
  let loaded: Promise<ApiClient> | null = null;
  const load = () => (loaded ??= import("./mockClient").then((mockModule) => new mockModule.MockApiClient()));
  return new Proxy({} as ApiClient, {
    get(_target, prop) {
      // not a thenable, so `await apiClient` never hangs on the proxy
      if (prop === "then" || typeof prop === "symbol") return undefined;
      return (...args: unknown[]) =>
        load().then((client) => (client as unknown as Record<string, AnyMethod>)[prop](...args));
    },
  });
}

// VITE_API_MODE=http picks the real API at build time; anything else keeps the mock for local dev and the demo
export const apiClient: ApiClient = IS_HTTP_MODE ? new HttpApiClient(API_BASE) : lazyMockClient();

export { ApiError } from "./httpClient";
