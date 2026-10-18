import { afterEach, describe, expect, it, vi } from "vitest";
import { errorFields, log, redact } from "../src/lib/log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redaction", () => {
  // fake values; the key-shaped one is built from parts so no literal in the source looks like a real key
  const openAiStyleKey = ["sk", "proj", "abcdefghijklmnop"].join("-");

  it("removes bearer tokens, device tokens, JWTs, API keys, and email addresses", () => {
    const text = redact(
      `Bearer abc.def-123 mwd_DeviceSecret1 eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl sk_live1234567890 ${openAiStyleKey} rzp_live_AbCdEf123456 a.person@example.com`,
    );
    for (const secret of ["abc.def-123", "DeviceSecret1", "eyJzdWIiOi", "live1234567890", "abcdefghijklmnop", "AbCdEf123456", "a.person@example.com"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("leaves ordinary text alone", () => {
    expect(redact("payment provider answered 502")).toBe("payment provider answered 502");
  });

  it("caps a very long value", () => {
    expect(redact("x".repeat(5000)).length).toBeLessThanOrEqual(1003);
  });
});

describe("structured logs", () => {
  it("writes one JSON line with the level, event, and fields, redacting strings and skipping undefined", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("request_failed", { requestId: "r-1", status: 500, path: "/api/v1/projects", note: "for a@example.com", skipped: undefined });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(spy.mock.calls[0][0] as string)).toEqual({
      level: "error",
      event: "request_failed",
      requestId: "r-1",
      status: 500,
      path: "/api/v1/projects",
      note: "for [email redacted]",
    });
  });

  it("sends warnings to console.warn and information to console.log", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    log.warn("config_incomplete");
    log.info("started");
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toEqual({ level: "warn", event: "config_incomplete" });
    expect(JSON.parse(info.mock.calls[0][0] as string)).toEqual({ level: "info", event: "started" });
  });

  it("reduces a thrown value to its name and message", () => {
    expect(errorFields(new TypeError("fetch failed"))).toEqual({ errorName: "TypeError", errorMessage: "fetch failed" });
    expect(errorFields("plain")).toEqual({ errorMessage: "plain" });
  });
});
