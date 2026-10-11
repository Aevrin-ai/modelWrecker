import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseAuthTokens } from "../src/db/supabase";

const auth = supabaseAuthTokens("https://project.supabase.co/", "anon-key");
const session = {
  access_token: "at",
  refresh_token: "rt",
  expires_at: 1_900_000_000,
  user: { id: "u1", email: "a@example.com", user_metadata: { full_name: "Alice", avatar_url: "https://img/a.png" } },
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(status === 204 ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("Supabase Auth token calls", () => {
  it("exchanges a PKCE code without following redirects, with the anon key only", async () => {
    const fetchMock = stubFetch(200, session);
    const result = await auth.exchangeCode("code-1", "verifier-1");
    expect(result).toEqual({
      ok: true,
      grant: { accessToken: "at", refreshToken: "rt", expiresAt: 1_900_000_000, user: { id: "u1", email: "a@example.com", name: "Alice", avatarUrl: "https://img/a.png" } },
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/token?grant_type=pkce");
    // The Workers runtime rejects redirect: "error", which broke sign-in once (#63).
    expect(init.redirect).toBe("manual");
    expect(init.headers).toEqual({ apikey: "anon-key", "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ auth_code: "code-1", code_verifier: "verifier-1" });
  });

  it("refreshes with the refresh token grant", async () => {
    const fetchMock = stubFetch(200, session);
    expect((await auth.refresh("rt-old")).ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/token?grant_type=refresh_token");
    expect(JSON.parse(String(init.body))).toEqual({ refresh_token: "rt-old" });
  });

  it("maps a rejected code or token to invalid, and an outage, rate limit, or redirect to unavailable", async () => {
    for (const [status, reason] of [[400, "invalid"], [401, "invalid"], [404, "invalid"], [429, "unavailable"], [500, "unavailable"], [302, "unavailable"]] as const) {
      stubFetch(status, { error: "x" });
      expect(await auth.refresh("rt")).toEqual({ ok: false, reason });
    }
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("network"))));
    expect(await auth.refresh("rt")).toEqual({ ok: false, reason: "unavailable" });
  });

  it("signs out this session only, with the user's access token", async () => {
    const fetchMock = stubFetch(204, null);
    expect(await auth.signOut("at")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/logout?scope=local");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer at");
    stubFetch(401, {});
    expect(await auth.signOut("expired")).toBe(false);
  });
});
