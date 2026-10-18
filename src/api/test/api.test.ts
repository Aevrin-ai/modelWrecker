import { beforeEach, describe, expect, it } from "vitest";
import { ApiHarness, type DeviceCodeBody, type DeviceTokenBody } from "./apiHarness";
import { readJson, type ErrorBody } from "./harness";
import type { CampaignBody, FindingBody, IdBody, TargetBody } from "./responses";
import { syncBody } from "./syncFixtures";

let api: ApiHarness;

beforeEach(() => {
  api = new ApiHarness();
});

describe("health and errors", () => {
  it("answers health without auth", async () => {
    expect((await api.call("GET", "/health")).status).toBe(200);
  });

  it("never leaks internals on unknown routes or bad JSON", async () => {
    const notFound = await api.callJson<ErrorBody>("GET", "/nope");
    expect(notFound.error).toBe("not_found");
    const bad = await api.call("POST", "/device/code", { raw: "{not json" });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(await bad.json())).not.toMatch(/at .*\.ts|stack/i);
  });

  it("refuses oversized bodies", async () => {
    const res = await api.call("POST", "/device/code", { raw: JSON.stringify({ name: "x".repeat(300_000) }) });
    expect(res.status).toBe(413);
  });
});

describe("device sign-in (RFC 8628)", () => {
  const requestCode = () => api.callJson<DeviceCodeBody>("POST", "/device/code", { body: { name: "laptop" } });
  const pollToken = (deviceCode: string) => api.callJson<DeviceTokenBody>("POST", "/device/token", { body: { device_code: deviceCode } });

  it("issues a token once, after approval, and stores only its hash", async () => {
    const code = await requestCode();
    expect(code.user_code).toMatch(/^[B-DF-HJ-NP-TV-XZ]{4}-[B-DF-HJ-NP-TV-XZ]{4}$/);
    expect(code.verification_uri_complete).toBe(`https://app.aevrin.net/dashboard/connect?code=${code.user_code}`);

    const pending = await api.call("POST", "/device/token", { body: { device_code: code.device_code } });
    expect(await readJson(pending)).toEqual({ error: "authorization_pending" });

    // faster than the 5 second interval
    api.clock += 1000;
    expect((await pollToken(code.device_code)).error).toBe("slow_down");

    expect((await api.call("POST", "/device/approve", { token: "token-a", body: { user_code: code.user_code } })).status).toBe(200);
    api.clock += 6000;
    const issued = await pollToken(code.device_code);
    expect(issued.device_token).toMatch(/^mwd_/);
    // landed in the default project
    expect(issued.project_id).toBeTruthy();

    api.clock += 6000;
    const again = await pollToken(code.device_code);
    // shown exactly once
    expect(again.error).toBe("expired_token");

    // neither the token nor the device code exists in plaintext anywhere in the database
    expect(api.everything()).not.toContain(issued.device_token);
    expect(api.everything()).not.toContain(code.device_code);
  });

  it("reports denial and expiry", async () => {
    const code = await requestCode();
    await api.call("POST", "/device/approve", { token: "token-a", body: { user_code: code.user_code, approve: false } });
    api.clock += 6000;
    expect((await pollToken(code.device_code)).error).toBe("access_denied");

    const late = await requestCode();
    api.clock += 16 * 60 * 1000;
    expect((await api.call("POST", "/device/approve", { token: "token-a", body: { user_code: late.user_code } })).status).toBe(410);
    expect((await pollToken(late.device_code)).error).toBe("expired_token");
  });

  it("will not let a user approve a device into someone else's project", async () => {
    const other = await api.callJson<IdBody>("POST", "/projects", { token: "token-b", body: { name: "Bob's" } });
    const code = await requestCode();
    const res = await api.call("POST", "/device/approve", { token: "token-a", body: { user_code: code.user_code, project_id: other.id } });
    expect(res.status).toBe(404);
  });

  it("refuses approval without a signed-in user", async () => {
    const code = await requestCode();
    expect((await api.call("POST", "/device/approve", { body: { user_code: code.user_code } })).status).toBe(401);
  });
});

describe("credentials stay on their own routes", () => {
  it("rejects a device token on user routes and a user token on device routes", async () => {
    const { device_token } = await api.signInDevice();
    expect((await api.call("GET", "/projects", { token: device_token })).status).toBe(401);
    expect((await api.call("POST", "/sync", { token: "token-a", body: syncBody() })).status).toBe(401);
    expect((await api.call("GET", "/projects")).status).toBe(401);
    expect((await api.call("POST", "/sync", { token: "mwd_forged", body: syncBody() })).status).toBe(401);
  });

  // the dashboard refreshes its session once and retries only on this exact code (src/dash/src/api/session.ts)
  it("answers a missing, malformed, expired, or revoked user token with 401 unauthenticated", async () => {
    for (const token of [undefined, "not-a-token", "token-expired", "a b", "mwd_forged"]) {
      const res = await api.call("GET", "/projects", { token });
      expect(res.status).toBe(401);
      expect((await readJson<ErrorBody>(res)).error).toBe("unauthenticated");
    }
    const malformed = await api.app.request("/api/v1/projects", { headers: { authorization: "Basic dXNlcjpwYXNz" } });
    expect(malformed.status).toBe(401);
    expect((await readJson<ErrorBody>(malformed)).error).toBe("unauthenticated");
  });
});

describe("account isolation", () => {
  it("never shows or changes another account's rows", async () => {
    const { device_token } = await api.signInDevice("token-a");
    await api.call("POST", "/sync", { token: device_token, body: syncBody() });
    const [finding] = await api.callJson<FindingBody[]>("GET", "/findings", { token: "token-a" });
    const [project] = await api.callJson<IdBody[]>("GET", "/projects", { token: "token-a" });

    expect(await api.callJson("GET", "/findings", { token: "token-b" })).toEqual([]);
    expect(await api.callJson("GET", "/projects", { token: "token-b" })).toEqual([]);
    expect((await api.call("GET", `/findings/${finding.id}`, { token: "token-b" })).status).toBe(404);
    expect((await api.call("PATCH", `/findings/${finding.id}`, { token: "token-b", body: { status: "fixed" } })).status).toBe(404);
    expect((await api.call("DELETE", `/projects/${project.id}`, { token: "token-b" })).status).toBe(404);
    expect((await api.callJson<{ totalFindings: number }>("GET", "/overview", { token: "token-b" })).totalFindings).toBe(0);
  });
});

describe("campaigns are configured here and run only on the device", () => {
  // built from parts so no literal in the source looks like a real credential
  const endpointWithCredentials = `https://${["user", "pass"].join(":")}@api.example.com/v1?key=secret`;

  it("requires an authorized target and follows draft -> ready -> draft", async () => {
    const project = await api.callJson<IdBody>("POST", "/projects", { token: "token-a", body: { name: "Acme" } });
    const refused = await api.call("POST", "/targets", {
      token: "token-a",
      body: { name: "bot", type: "chat", projectId: project.id, authorized: false },
    });
    expect(refused.status).toBe(422);

    const target = await api.callJson<TargetBody>("POST", "/targets", {
      token: "token-a",
      body: { name: "bot", type: "chat", projectId: project.id, endpoint: endpointWithCredentials, authorized: true },
    });
    // credentials and query stripped
    expect(target.endpoint).toBe("https://api.example.com/v1");

    const campaign = await api.callJson<CampaignBody>("POST", "/campaigns", {
      token: "token-a",
      body: {
        name: "Sweep",
        projectId: project.id,
        targetId: target.id,
        strategies: ["crescendo"],
        objectiveCount: 3,
        stopCondition: "complete",
        concurrency: 1,
        maxAttempts: null,
      },
    });
    expect(campaign.status).toBe("draft");
    expect((await api.callJson<CampaignBody>("POST", `/campaigns/${campaign.id}/ready`, { token: "token-a" })).status).toBe("ready");
    expect((await api.call("POST", `/campaigns/${campaign.id}/ready`, { token: "token-a" })).status).toBe(409);
    expect((await api.callJson<CampaignBody>("POST", `/campaigns/${campaign.id}/draft`, { token: "token-a" })).status).toBe("draft");
  });
});
