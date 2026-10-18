// plan limits on the server and signed entitlements (issue #11), offline with a fake Razorpay
import { beforeEach, describe, expect, it } from "vitest";
import { verifyToken, type EntitlementSigner } from "../src/services/entitlements/signing";
import { BillingHarness, testSigner } from "./billingHarness";
import { readJson, type ErrorBody } from "./harness";
import type { HeartbeatBody } from "./responses";

let signer: EntitlementSigner;
let billing: BillingHarness;

beforeEach(async () => {
  signer ??= await testSigner();
  billing = new BillingHarness(signer);
});

async function payForPro(): Promise<void> {
  const order = await billing.checkout("token-a");
  await billing.verify("token-a", order.orderId, billing.rzp.pay(order.orderId));
}

describe("plan limits on the server", () => {
  it("allows one device on Free and ten on Pro", async () => {
    expect((await billing.linkDevice("token-a")).status).toBe(200);
    const second = await billing.linkDevice("token-a");
    expect(second.status).toBe(403);
    expect(second.error).toBe("plan_limit");
    await payForPro();
    expect((await billing.linkDevice("token-a")).status).toBe(200);
  });

  it("caps active projects on Free", async () => {
    await billing.call("GET", "/me", { token: "token-a" });
    for (const name of ["one", "two"]) {
      expect((await billing.call("POST", "/projects", { token: "token-a", body: { name, description: "" } })).status).toBe(201);
    }
    const third = await billing.call("POST", "/projects", { token: "token-a", body: { name: "three", description: "" } });
    expect(third.status).toBe(403);
  });

  it("keeps evidence and transcript sync for Pro", async () => {
    await billing.call("GET", "/me", { token: "token-a" });
    const res = await billing.call("PATCH", "/settings", { token: "token-a", body: { sync: { detailedEvidence: true } } });
    expect(res.status).toBe(403);
    expect((await readJson<ErrorBody>(res)).error).toBe("upgrade_required");
  });
});

describe("signed entitlements (issue #11)", () => {
  async function deviceToken(token = "token-a"): Promise<string> {
    const code = await billing.callJson<{ user_code: string; device_code: string }>("POST", "/device/code", {
      body: { name: "laptop", os: "Linux", engine_version: "0.0.3" },
    });
    await billing.call("POST", "/device/approve", { token, body: { user_code: code.user_code } });
    billing.clock += 6000;
    return (await billing.callJson<{ device_token: string }>("POST", "/device/token", { body: { device_code: code.device_code } })).device_token;
  }

  const entitlementOf = async (deviceTokenValue: string) =>
    (await billing.callJson<{ entitlement: string }>("GET", "/device/entitlement", { token: deviceTokenValue })).entitlement;

  it("publishes the public key", async () => {
    const keys = await billing.callJson<{ keys: unknown[] }>("GET", "/entitlements/keys");
    expect(keys.keys).toEqual([{ kid: "test-1", kty: "OKP", crv: "Ed25519", alg: "EdDSA", x: signer.publicKey }]);
  });

  it("signs a Free entitlement on heartbeat that the public key verifies", async () => {
    const device = await deviceToken();
    const heartbeat = await billing.callJson<HeartbeatBody>("POST", "/device/heartbeat", { token: device, body: { engine_version: "0.0.3" } });
    expect(heartbeat.plan).toBe("free");
    const payload = await verifyToken(String(heartbeat.entitlement), signer.publicKey);
    expect(payload).toMatchObject({ v: 1, sub: "user-a", plan: "free", features: { advanced_strategies: false, mcp: false } });
    expect(payload!.limits.campaigns).toBe(20);
    expect(payload!.exp - payload!.iat).toBe(7 * 24 * 3600);
  });

  it("rejects a token whose payload was edited", async () => {
    const device = await deviceToken();
    const entitlement = await entitlementOf(device);
    const [header, payload, signature] = String(entitlement).split(".");
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    claims.plan = "enterprise";
    const forged = `${header}.${btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${signature}`;
    expect(await verifyToken(forged, signer.publicKey)).toBeNull();
  });

  it("issues Pro after payment, never past the paid-until date, plus any bonus", async () => {
    const device = await deviceToken();
    await payForPro();
    await billing.db.table("subscriptions").update({ owner_id: "user-a" }, { bonus: { attacks: 500 } });
    billing.clock = Date.parse("2026-10-30T10:00:00Z");
    const entitlement = await entitlementOf(device);
    const payload = (await verifyToken(entitlement, signer.publicKey))!;
    expect(payload.plan).toBe("pro");
    expect(payload.features.advanced_strategies).toBe(true);
    expect(payload.limits.attacks).toBe(100000 + 500);
    expect(payload.exp).toBe(Date.parse((await billing.subscription()).paidUntil) / 1000);
  });

  it("gives no entitlement when signing is not configured", async () => {
    billing.app = billing.makeApp({ signer: undefined });
    const device = await deviceToken();
    const heartbeat = await billing.callJson<HeartbeatBody>("POST", "/device/heartbeat", { token: device, body: {} });
    expect(heartbeat.entitlement).toBeUndefined();
    expect((await billing.call("GET", "/device/entitlement", { token: device })).status).toBe(503);
  });
});
