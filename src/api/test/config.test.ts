import { describe, expect, it } from "vitest";
import { checkConfig } from "../src/config";

const COMPLETE = {
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  APP_ORIGIN: "https://vyra.aevrin.ai",
};

describe("config check", () => {
  it("accepts a complete configuration with no errors or warnings", () => {
    expect(checkConfig(COMPLETE)).toEqual({ errors: [], warnings: [] });
  });

  it("names every missing required setting, treating blank as missing", () => {
    const report = checkConfig({ APP_ORIGIN: "https://vyra.aevrin.ai", SUPABASE_ANON_KEY: "   " });
    expect(report.errors).toEqual(["SUPABASE_URL is not set", "SUPABASE_ANON_KEY is not set", "SUPABASE_SERVICE_ROLE_KEY is not set"]);
  });

  it.each(["ftp://abc.supabase.co", "not a url", "http://abc.supabase.co"])("rejects %j as a service URL", (value) => {
    expect(checkConfig({ ...COMPLETE, SUPABASE_URL: value }).errors).toEqual(["SUPABASE_URL must be an https URL"]);
  });

  it("allows plain http for a Worker running on this machine", () => {
    expect(checkConfig({ ...COMPLETE, APP_ORIGIN: "http://localhost:8787" }).errors).toEqual([]);
  });

  it("never puts a setting's value in a message", () => {
    const report = checkConfig({ ...COMPLETE, SUPABASE_URL: "ftp://private-host.internal" });
    expect(report.errors.join(" ")).not.toContain("private-host");
  });

  it("warns when an optional feature is only half set up", () => {
    expect(checkConfig({ ...COMPLETE, RAZORPAY_KEY_ID: "rzp_test_key" }).warnings).toEqual(["billing is off: RAZORPAY_KEY_SECRET not set"]);
    expect(checkConfig({ ...COMPLETE, ENTITLEMENT_KEY_ID: "2026-10-a" }).warnings).toEqual([
      "entitlement signing is off: ENTITLEMENT_SIGNING_KEY, ENTITLEMENT_PUBLIC_KEY not set",
    ]);
  });

  it("warns when billing is on but payment webhooks are not", () => {
    const report = checkConfig({ ...COMPLETE, RAZORPAY_KEY_ID: "rzp_test_key", RAZORPAY_KEY_SECRET: "secret" });
    expect(report.warnings).toEqual(["payment webhooks are off: RAZORPAY_WEBHOOK_SECRET not set"]);
  });
});
