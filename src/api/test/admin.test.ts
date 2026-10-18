// admin console access, offline: staff checks, authenticator codes, and admin sessions
import { beforeEach, describe, expect, it } from "vitest";
import { base32Encode, decryptSecret, encryptSecret, totpAt, verifyTotp } from "../src/services/admin/totp";
import { createApp } from "../src/app";
import { isStaffEmail } from "../src/routes/admin";
import { AdminHarness, TOTP_KEY } from "./adminHarness";
import { readJson, type ErrorBody } from "./harness";

let admin: AdminHarness;

beforeEach(() => {
  admin = new AdminHarness();
});

const verifyCode = (code: string) => admin.call("POST", "/admin/mfa/verify", { token: "token-s", body: { code } });

describe("authenticator codes (RFC 6238)", () => {
  it("matches the RFC test vector and refuses a reused step", async () => {
    const secret = base32Encode(new TextEncoder().encode("12345678901234567890"));
    // RFC 6238 appendix B, last 6 digits
    expect(await totpAt(secret, 59_000)).toBe("287082");
    expect(await verifyTotp(secret, "287082", 59_000, 0)).toBe(1);
    expect(await verifyTotp(secret, "287082", 59_000, 1)).toBeNull();
    expect(await verifyTotp(secret, "000000", 59_000, 0)).toBeNull();
    expect(await verifyTotp(secret, "28708", 59_000, 0)).toBeNull();
  });

  it("encrypts secrets with a fresh IV and decrypts them", async () => {
    const first = await encryptSecret(TOTP_KEY, "JBSWY3DPEHPK3PXP");
    const second = await encryptSecret(TOTP_KEY, "JBSWY3DPEHPK3PXP");
    expect(first).not.toBe(second);
    expect(first).not.toContain("JBSWY3DPEHPK3PXP");
    expect(await decryptSecret(TOTP_KEY, first)).toBe("JBSWY3DPEHPK3PXP");
  });
});

describe("staff-only access (issue #43)", () => {
  it("accepts only a verified address exactly on aevrin.net", async () => {
    expect(isStaffEmail("ops@aevrin.net")).toBe(true);
    expect(isStaffEmail("Lead@AEVRIN.NET")).toBe(true);
    for (const bad of ["x@aevrin.net.evil.com", "x@evilaevrin.net", "x@sub.aevrin.net", "aevrin.net", "", null]) {
      expect(isStaffEmail(bad)).toBe(false);
    }
    for (const token of ["token-a", "token-lookalike", "token-unverified"]) {
      const res = await admin.call("GET", "/admin/mfa/status", { token });
      expect(res.status).toBe(403);
      expect((await readJson<ErrorBody>(res)).error).toBe("admin_only");
    }
    expect((await admin.call("GET", "/admin/mfa/status")).status).toBe(401);
  });

  it("refuses every admin route without an admin session, even for staff", async () => {
    for (const path of ["/admin/users", "/admin/users/user-a", "/admin/metrics", "/admin/traffic", "/admin/audit", "/admin/payments", "/admin/me"]) {
      expect((await admin.call("GET", path, { token: "token-s" })).status).toBe(401);
    }
    const res = await admin.call("PATCH", "/admin/users/user-a/plan", { token: "token-s", body: { plan: "pro", paidUntil: null, reason: "test" } });
    expect(res.status).toBe(401);
  });

  it("answers 503 when the admin console is not configured", async () => {
    admin.app = createApp(admin.deps({ admin: undefined }));
    expect((await admin.call("GET", "/admin/mfa/status", { token: "token-s" })).status).toBe(503);
  });

  it("enrolls, stores the secret encrypted, and starts a session", async () => {
    const { secret, session, recovery } = await admin.enroll();
    const row = admin.db.table("admin_mfa").rows[0];
    expect(row.secret_enc).not.toContain(secret);
    expect(JSON.stringify(row)).not.toContain(recovery[0]);
    expect(recovery).toHaveLength(10);
    expect(admin.db.table("admin_sessions").rows[0].token_hash).not.toBe(session);
    const profile = await admin.callJson<{ email: string }>("GET", "/admin/me", { token: "token-s", session });
    expect(profile.email).toBe("ops@aevrin.net");
    expect((await admin.call("POST", "/admin/mfa/enroll", { token: "token-s" })).status).toBe(409);
  });

  it("never accepts the same code twice, and accepts the next one", async () => {
    const { secret } = await admin.enroll();
    const reused = await verifyCode(await totpAt(secret, admin.clock));
    expect(reused.status).toBe(400);
    admin.clock += 30_000;
    const next = await verifyCode(await totpAt(secret, admin.clock));
    expect(next.status).toBe(200);
  });

  it("locks after five wrong codes", async () => {
    const { secret } = await admin.enroll();
    admin.clock += 30_000;
    for (let i = 0; i < 5; i++) {
      expect((await verifyCode("000000")).status).toBe(400);
    }
    const locked = await verifyCode(await totpAt(secret, admin.clock));
    expect(locked.status).toBe(429);
    admin.clock += 16 * 60_000;
    expect((await verifyCode(await totpAt(secret, admin.clock))).status).toBe(200);
  });

  it("accepts each recovery code once", async () => {
    const { recovery } = await admin.enroll();
    expect((await admin.call("POST", "/admin/mfa/verify", { token: "token-s", body: { recoveryCode: recovery[0] } })).status).toBe(200);
    expect((await admin.call("POST", "/admin/mfa/verify", { token: "token-s", body: { recoveryCode: recovery[0] } })).status).toBe(400);
  });

  it("binds a session to its staff member and ends it when idle or after 8 hours", async () => {
    const { session, secret } = await admin.enroll();
    await admin.enroll("token-s2");
    expect((await admin.call("GET", "/admin/me", { token: "token-s2", session })).status).toBe(401);
    admin.clock += 31 * 60_000;
    expect((await admin.call("GET", "/admin/me", { token: "token-s", session })).status).toBe(401);

    // a fresh code gives a new session; staying active keeps it alive, but never past 8 hours
    const freshCode = await totpAt(secret, admin.clock);
    const fresh = (await admin.callJson<{ sessionToken: string }>("POST", "/admin/mfa/verify", { token: "token-s", body: { code: freshCode } })).sessionToken;
    for (let minutes = 25; minutes <= 475; minutes += 25) {
      admin.clock += 25 * 60_000;
      expect((await admin.call("GET", "/admin/me", { token: "token-s", session: fresh })).status).toBe(200);
    }
    // 500 minutes after it started
    admin.clock += 25 * 60_000;
    expect((await admin.call("GET", "/admin/me", { token: "token-s", session: fresh })).status).toBe(401);
  });

  it("ends a session on request", async () => {
    const { session } = await admin.enroll();
    expect((await admin.call("POST", "/admin/session/end", { token: "token-s", session })).status).toBe(204);
    expect((await admin.call("GET", "/admin/me", { token: "token-s", session })).status).toBe(401);
  });
});
