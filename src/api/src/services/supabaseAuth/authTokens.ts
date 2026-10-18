import type { AuthTokens, GrantResult } from "../../types/deps";
import { supabaseFetch } from "../../database/supabaseClient";

/** The fields of a Supabase Auth token response this API reads. */
interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id?: string; email?: unknown; user_metadata?: Record<string, unknown> };
}

const UNAVAILABLE: GrantResult = { ok: false, reason: "unavailable" };

interface AuthEndpoint {
  base: string;
  anonKey: string;
}

// the timed fetch never retries a POST, so a single-use refresh token is never sent twice
function postToAuth(endpoint: AuthEndpoint, path: string, body: unknown, accessToken?: string): Promise<Response> {
  return supabaseFetch(`${endpoint.base}${path}`, {
    method: "POST",
    headers: {
      apikey: endpoint.anonKey,
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
    // never follow a redirect: "manual" because the Workers runtime rejects "error"; a 3xx is refused below
    redirect: "manual",
  });
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function isUnavailableStatus(status: number): boolean {
  return status === 429 || status >= 500 || (status >= 300 && status < 400);
}

function grantFromResponse(data: TokenResponse | null): GrantResult {
  if (!data?.access_token || !data.refresh_token || !data.user?.id) return UNAVAILABLE;
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    grant: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Number(data.expires_at) || Math.floor(Date.now() / 1000) + Number(data.expires_in ?? 3600),
      user: {
        id: String(data.user.id),
        email: textOrNull(data.user.email),
        name: textOrNull(meta.full_name) ?? textOrNull(meta.name),
        avatarUrl: textOrNull(meta.avatar_url) ?? textOrNull(meta.picture),
      },
    },
  };
}

async function requestGrant(
  endpoint: AuthEndpoint,
  grantType: "pkce" | "refresh_token",
  body: Record<string, string>,
): Promise<GrantResult> {
  let res: Response;
  try {
    res = await postToAuth(endpoint, `/token?grant_type=${grantType}`, body);
  } catch {
    return UNAVAILABLE;
  }
  if (isUnavailableStatus(res.status)) return UNAVAILABLE;
  if (!res.ok) return { ok: false, reason: "invalid" };
  const data = (await res.json().catch(() => null)) as TokenResponse | null;
  return grantFromResponse(data);
}

/** Supabase Auth's token endpoints, called with the public anon key (docs/security/authentication.md). */
export function supabaseAuthTokens(url: string, anonKey: string): AuthTokens {
  const endpoint: AuthEndpoint = { base: `${url.replace(/\/+$/, "")}/auth/v1`, anonKey };
  return {
    exchangeCode: (code, verifier) => requestGrant(endpoint, "pkce", { auth_code: code, code_verifier: verifier }),
    refresh: (refreshToken) => requestGrant(endpoint, "refresh_token", { refresh_token: refreshToken }),
    async signOut(accessToken) {
      try {
        const res = await postToAuth(endpoint, "/logout?scope=local", {}, accessToken);
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
