// admin console API (docs/security/admin.md): staff only, checked on the server; every change to a user is audited
import type { ApiApp, AppMiddleware } from "../types/appEnv";
import type { Deps } from "../types/deps";
import { createKeyLimit } from "../middleware/rateLimit";
import type { AdminContext } from "../controllers/admin/context";
import { adminSession, staffOnly } from "../middleware/adminGuards";
import { activateMfa, adminMe, endAdminSession, enrollMfa, mfaStatus, verifyMfa } from "../controllers/admin/mfa";
import { listAudit, listPayments, metrics, traffic } from "../controllers/admin/reports";
import { changeSyncSettings, deleteUser, renameUser, resetUserMfa, revokeUserDevice, suspendUser } from "../controllers/admin/userAccount";
import { adjustCredit, changePlan, refundPayment, setBonus } from "../controllers/admin/userBilling";
import { listUsers, userDetail } from "../controllers/admin/users";

// existing imports of isStaffEmail from this module keep working
export { isStaffEmail } from "../controllers/admin/context";

/** The checks in their required order: a user session, a verified staff email, a live admin session. */
interface AdminGuards {
  requireUser: AppMiddleware;
  staff: AppMiddleware;
  session: AppMiddleware;
}

// the authenticator steps need a staff account but not yet an admin session
function registerAccessRoutes(app: ApiApp, admin: AdminContext, guards: AdminGuards) {
  const { requireUser, staff, session } = guards;
  app.get("/admin/mfa/status", requireUser, staff, (c) => mfaStatus(admin, c));
  app.post("/admin/mfa/enroll", requireUser, staff, (c) => enrollMfa(admin, c));
  app.post("/admin/mfa/activate", requireUser, staff, (c) => activateMfa(admin, c));
  app.post("/admin/mfa/verify", requireUser, staff, (c) => verifyMfa(admin, c));
  app.post("/admin/session/end", requireUser, staff, session, (c) => endAdminSession(admin, c));
  app.get("/admin/me", requireUser, staff, session, (c) => adminMe(c));
}

function registerUserRoutes(app: ApiApp, admin: AdminContext, guards: AdminGuards) {
  const { requireUser, staff, session } = guards;
  app.get("/admin/users", requireUser, staff, session, (c) => listUsers(admin, c));
  app.get("/admin/users/:id", requireUser, staff, session, (c) => userDetail(admin, c));
  app.patch("/admin/users/:id/plan", requireUser, staff, session, (c) => changePlan(admin, c));
  app.post("/admin/users/:id/bonus", requireUser, staff, session, (c) => setBonus(admin, c));
  app.post("/admin/users/:id/credit", requireUser, staff, session, (c) => adjustCredit(admin, c));
  app.post("/admin/users/:id/payments/:paymentId/refund", requireUser, staff, session, (c) => refundPayment(admin, c));
  app.patch("/admin/users/:id/settings", requireUser, staff, session, (c) => changeSyncSettings(admin, c));
  app.patch("/admin/users/:id/profile", requireUser, staff, session, (c) => renameUser(admin, c));
  app.post("/admin/users/:id/devices/:deviceId/revoke", requireUser, staff, session, (c) => revokeUserDevice(admin, c));
  app.post("/admin/users/:id/suspend", requireUser, staff, session, (c) => suspendUser(admin, c));
  app.post("/admin/users/:id/reset-mfa", requireUser, staff, session, (c) => resetUserMfa(admin, c));
  app.delete("/admin/users/:id", requireUser, staff, session, (c) => deleteUser(admin, c));
}

function registerReportRoutes(app: ApiApp, admin: AdminContext, guards: AdminGuards) {
  const { requireUser, staff, session } = guards;
  app.get("/admin/payments", requireUser, staff, session, (c) => listPayments(admin, c));
  app.get("/admin/audit", requireUser, staff, session, (c) => listAudit(admin, c));
  app.get("/admin/metrics", requireUser, staff, session, (c) => metrics(admin, c));
  app.get("/admin/traffic", requireUser, staff, session, (c) => traffic(admin, c));
}

export function registerAdminRoutes(app: ApiApp, deps: Deps, requireUser: AppMiddleware): void {
  const admin: AdminContext = {
    deps,
    db: deps.serviceDb,
    limit: createKeyLimit(deps, "Too many requests. Wait a moment and try again."),
  };
  const guards: AdminGuards = { requireUser, staff: staffOnly(admin), session: adminSession(admin) };
  registerAccessRoutes(app, admin, guards);
  registerUserRoutes(app, admin, guards);
  registerReportRoutes(app, admin, guards);
}
