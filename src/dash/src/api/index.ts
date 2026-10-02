/*
  API entry point and the mock -> real swap point.

  VITE_API_MODE=http selects HttpApiClient (the real control-plane API, with Google sign-in).
  Anything else, including unset, keeps MockApiClient so local dev and the demo work with no
  backend. The mode is fixed at build time (src/lib/config.ts). Nothing else in the UI changes.
*/

import type { ApiClient } from "./client";
import { HttpApiClient } from "./httpClient";
import { MockApiClient } from "./mockClient";
import { API_BASE, IS_HTTP_MODE } from "@/lib/config";

// The single place the active backend is chosen.
export const apiClient: ApiClient = IS_HTTP_MODE ? new HttpApiClient(API_BASE) : new MockApiClient();

export type { ApiClient, DeviceApproval } from "./client";
export { ApiError } from "./httpClient";
