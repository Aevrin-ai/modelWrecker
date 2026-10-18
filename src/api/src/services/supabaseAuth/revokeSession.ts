import type { AuthTokens } from "../../types/deps";

export async function revoke(auth: AuthTokens, accessToken: string | null, refreshToken: string | undefined): Promise<void> {
  if (accessToken && (await auth.signOut(accessToken))) return;
  // the access token had expired: a refresh proves the session and gives a token that can sign it out
  if (!refreshToken) return;
  const result = await auth.refresh(refreshToken);
  if (result.ok) await auth.signOut(result.grant.accessToken);
}
