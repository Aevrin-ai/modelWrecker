// a stand-in for Supabase Auth and cookie readers, for the dashboard sign-in tests
import type { AuthTokens, GrantResult } from "../src/types/deps";

export const VERIFIER = "v".repeat(43);

/** Stands in for Supabase Auth: one-time codes, rotating refresh tokens, and reuse revoking the session. */
export class FakeSupabaseAuth implements AuthTokens {
  codes = new Map([["good-code", "user-a"]]);
  /** refresh token -> session; `used` once rotated. */
  refreshTokens = new Map<string, { session: string; used: boolean }>();
  accessTokens = new Map<string, { session: string; expired: boolean }>();
  revoked = new Set<string>();
  down = false;
  private issuedCount = 0;

  private issue(session: string): GrantResult {
    this.issuedCount += 1;
    const serial = this.issuedCount;
    this.refreshTokens.set(`rt-${serial}-abcdefgh`, { session, used: false });
    this.accessTokens.set(`at-${serial}`, { session, expired: false });
    return {
      ok: true,
      grant: {
        accessToken: `at-${serial}`,
        refreshToken: `rt-${serial}-abcdefgh`,
        expiresAt: 1_900_000_000,
        user: { id: "user-a", email: "a@example.com", name: "Alice", avatarUrl: null },
      },
    };
  }

  async exchangeCode(code: string, verifier: string): Promise<GrantResult> {
    if (this.down) return { ok: false, reason: "unavailable" };
    if (!this.codes.has(code) || verifier !== VERIFIER) return { ok: false, reason: "invalid" };
    this.codes.delete(code);
    this.issuedCount += 1;
    return this.issue(`session-${this.issuedCount}`);
  }

  async refresh(token: string): Promise<GrantResult> {
    if (this.down) return { ok: false, reason: "unavailable" };
    const refreshToken = this.refreshTokens.get(token);
    if (!refreshToken || this.revoked.has(refreshToken.session)) return { ok: false, reason: "invalid" };
    if (refreshToken.used) {
      // reuse: the whole session is revoked
      this.revoked.add(refreshToken.session);
      return { ok: false, reason: "invalid" };
    }
    refreshToken.used = true;
    return this.issue(refreshToken.session);
  }

  async signOut(accessToken: string): Promise<boolean> {
    const access = this.accessTokens.get(accessToken);
    if (!access || access.expired || this.revoked.has(access.session)) return false;
    this.revoked.add(access.session);
    return true;
  }

  userFor(accessToken: string) {
    const access = this.accessTokens.get(accessToken);
    const isLive = access && !access.expired && !this.revoked.has(access.session);
    return isLive ? { id: "user-a", email: "a@example.com", name: "Alice" } : null;
  }
}

/** The refresh cookie a response sets, as a `cookie` request header, or null when it is cleared or absent. */
export function refreshCookie(res: Response): string | null {
  const line = res.headers.getSetCookie().find((cookie) => cookie.startsWith("__Secure-mw_rt="));
  if (!line) return null;
  const value = line.split(";")[0];
  return value === "__Secure-mw_rt=" ? null : value;
}

/** True when the response clears both the refresh cookie and the signed-in hint. */
export function cleared(res: Response): boolean {
  const lines = res.headers.getSetCookie();
  return ["__Secure-mw_rt=", "mw_signed_in="].every((name) => lines.some((line) => line.startsWith(name) && /Max-Age=0/i.test(line)));
}
