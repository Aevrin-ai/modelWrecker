import type { AppContext } from "../../types/appEnv";
import type { Row } from "../../types/deps";
import { clientIp } from "../../middleware/rateLimit";
import { str } from "../../lib/strings";
import type { AdminContext } from "../../controllers/admin/context";
import { adminAuditRepository } from "../../repositories/adminAudit";

/** Write one admin action to admin_audit, with who did it, to whom, and why. */
export async function writeAudit(
  admin: AdminContext,
  c: AppContext,
  action: string,
  target: Row | null,
  reason: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const user = c.get("user");
  await adminAuditRepository(admin.db).insert({
    admin_id: user.id,
    admin_email: str(user.email),
    action,
    target_user_id: target ? str(target.id) : null,
    target_email: target ? str(target.email) || null : null,
    reason,
    detail,
    ip: clientIp(c),
    created_at: admin.deps.now().toISOString(),
  });
}

export function auditView(entry: Row) {
  return {
    id: str(entry.id),
    adminEmail: str(entry.admin_email),
    action: str(entry.action),
    targetUserId: entry.target_user_id ? str(entry.target_user_id) : null,
    targetEmail: entry.target_email ? str(entry.target_email) : null,
    reason: entry.reason ? str(entry.reason) : null,
    detail: (entry.detail as Record<string, unknown>) ?? {},
    createdAt: str(entry.created_at),
  };
}
