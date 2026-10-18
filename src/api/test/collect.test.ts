// first-party page analytics, offline: what a beacon stores and what it never stores
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { cleanPath, deviceType, referrerHost } from "../src/services/pageViews";
import { AdminHarness } from "./adminHarness";

let harness: AdminHarness;

beforeEach(() => {
  harness = new AdminHarness();
});

const beacon = (body: unknown, headers: Record<string, string> = {}) =>
  harness.call("POST", "/collect", {
    raw: JSON.stringify(body),
    headers: { "cf-connecting-ip": "203.0.113.9", "user-agent": "Mozilla/5.0 (iPhone; Mobile)", "cf-ipcountry": "IN", ...headers },
  });

describe("page analytics (issue #45)", () => {
  it("stores a cleaned path, the referrer host, and a daily hash, never the IP", async () => {
    const res = await beacon({ s: "dashboard", p: "/dashboard/campaigns/0f8fad5b-d9cb-469f-a165-70867728950e?tab=1#x", r: "https://www.google.com/search?q=secret" });
    expect(res.status).toBe(204);
    const [row] = harness.db.table("page_views").rows;
    expect(row).toMatchObject({ site: "dashboard", path: "/dashboard/campaigns/:id", referrer: "google.com", country: "IN", device: "mobile", day: "2026-10-02" });
    expect(JSON.stringify(row)).not.toContain("203.0.113.9");
    expect(JSON.stringify(row)).not.toContain("secret");
    await beacon({ s: "landing", p: "/", r: "https://app.aevrin.net/dashboard/" });
    expect(harness.db.table("page_views").rows[1].referrer).toBeNull();
    // same visitor, same day
    expect(harness.db.table("page_views").rows[1].visitor).toBe(row.visitor);
    harness.clock += 24 * 3600_000;
    await beacon({ s: "landing", p: "/", r: "" });
    // a new hash every day
    expect(harness.db.table("page_views").rows[2].visitor).not.toBe(row.visitor);
  });

  it("does not count Do Not Track, Global Privacy Control, bots, bad bodies, or without a salt", async () => {
    await beacon({ s: "landing", p: "/" }, { dnt: "1" });
    await beacon({ s: "landing", p: "/" }, { "sec-gpc": "1" });
    await beacon({ s: "landing", p: "/" }, { "user-agent": "Googlebot/2.1" });
    await beacon({ s: "admin", p: "/" });
    await beacon({ s: "landing", p: "/", extra: 1 });
    harness.app = createApp(harness.deps({ analyticsSalt: undefined }));
    await beacon({ s: "landing", p: "/" });
    expect(harness.db.table("page_views").rows).toHaveLength(0);
  });

  it("helpers", () => {
    expect(cleanPath("dashboard//x/12345/y")).toBe("/dashboard/x/:id/y");
    expect(referrerHost("javascript:alert(1)", "app.aevrin.net")).toBeNull();
    expect(deviceType("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceType("Mozilla/5.0 (Windows NT 10.0)")).toBe("desktop");
  });
});
