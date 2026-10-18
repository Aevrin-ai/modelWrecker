// Run with `npm test` (Node's built-in test runner; no test framework to install).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeError } from "./errorMessage.ts";

describe("safe error messages", () => {
  it("shows the server's code and message for a client error, with no reference", () => {
    const shown = safeError(409, { error: "conflict", message: "That project already exists.", requestId: "11111111-2222-3333-4444-555555555555" });
    assert.deepEqual(shown, { code: "conflict", message: "That project already exists.", requestId: "11111111-2222-3333-4444-555555555555" });
  });

  it("adds the reference id to a server error so the person can quote it to support", () => {
    const shown = safeError(503, { error: "service_unavailable", message: "The service is busy right now. Try again in a moment.", requestId: "8a1b2c3d4e5f6789-SIN" });
    assert.equal(shown.message, "The service is busy right now. Try again in a moment. Reference: 8a1b2c3d4e5f6789-SIN.");
    assert.equal(shown.requestId, "8a1b2c3d4e5f6789-SIN");
  });

  it("falls back to the response header when the body has no reference", () => {
    const shown = safeError(500, { error: "internal", message: "The server hit an unexpected error." }, "11111111-2222-3333-4444-555555555555");
    assert.equal(shown.requestId, "11111111-2222-3333-4444-555555555555");
    assert.match(shown.message, /Reference: 11111111-2222-3333-4444-555555555555\.$/);
  });

  it("uses a fallback message when the body is missing or not JSON", () => {
    assert.deepEqual(safeError(502, undefined), {
      code: "http_502",
      message: "The control plane had a problem. Try again shortly.",
      requestId: null,
    });
    assert.equal(safeError(404, "not json").message, "That record was not found.");
  });

  it("ignores a code or reference with an unexpected shape", () => {
    const shown = safeError(500, { error: "<script>", requestId: "has spaces and <tags>" }, "also bad!");
    assert.equal(shown.code, "http_500");
    assert.equal(shown.requestId, null);
    assert.doesNotMatch(shown.message, /Reference/);
  });

  it("caps a very long server message", () => {
    assert.equal(safeError(400, { message: "x".repeat(1000) }).message.length, 300);
  });
});
