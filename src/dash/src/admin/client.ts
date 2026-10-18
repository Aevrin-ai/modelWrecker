// admin console API client (docs/security/admin.md); mock mode answers from demo data and contacts nothing
import { IS_HTTP_MODE } from "@/lib/config";
import type { AdminClient } from "./adminTypes";
import { HttpAdminClient } from "./httpAdminClient";
import { mockAdminClient } from "./mockClient";

export type * from "./adminTypes";

// IS_HTTP_MODE is a build-time constant and the mock has no side effects, so an http build drops the demo data
export const adminClient: AdminClient = IS_HTTP_MODE ? new HttpAdminClient() : mockAdminClient;
