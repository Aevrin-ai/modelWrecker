import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, DbError, INTERNAL_MESSAGE, UNAVAILABLE_MESSAGE, classifyError, isDbUnavailable } from "../src/lib/errors";

describe("error classification", () => {
  it("passes a known error's status, code, and message through unchanged", () => {
    expect(classifyError(new ApiError(409, "conflict", "That project already exists."))).toEqual({
      status: 409,
      code: "conflict",
      message: "That project already exists.",
      unexpected: false,
    });
  });

  it("turns a validation failure into a 422 that names the field", () => {
    const parsed = z.object({ name: z.string() }).safeParse({ name: 5 });
    if (parsed.success) throw new Error("the input should have been rejected");
    const failure = classifyError(parsed.error);
    expect(failure).toMatchObject({ status: 422, code: "invalid_request", unexpected: false });
    expect(failure.message).toMatch(/^name: /);
  });

  it.each(["", "PGRST000", "PGRST001", "PGRST002", "08001", "08006", "53300", "57014", "57P03", "40001", "40P01"])(
    "treats database code %j as unavailable, so the caller gets a 503 and can retry",
    (code) => {
      const err = new DbError("the database did not answer", code);
      expect(isDbUnavailable(err)).toBe(true);
      expect(classifyError(err)).toEqual({ status: 503, code: "service_unavailable", message: UNAVAILABLE_MESSAGE, unexpected: true });
    },
  );

  it.each(["23505", "23503", "42P01", "PGRST116", "auth_404"])(
    "keeps database code %j an internal error, never a retryable 503",
    (code) => {
      expect(classifyError(new DbError("the request was wrong", code))).toMatchObject({ status: 500, code: "internal" });
    },
  );

  it("never puts an unexpected error's own text in the response", () => {
    const failure = classifyError(new Error('relation "private_table" does not exist'));
    expect(failure).toEqual({ status: 500, code: "internal", message: INTERNAL_MESSAGE, unexpected: true });
    expect(failure.message).not.toContain("private_table");
  });

  it("handles a thrown value that is not an Error", () => {
    expect(classifyError("a plain string")).toMatchObject({ status: 500, code: "internal", unexpected: true });
  });
});
