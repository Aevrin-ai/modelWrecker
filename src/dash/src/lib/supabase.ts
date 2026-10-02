/*
  The Supabase client, used ONLY for Google sign-in and the user's session (http mode).

  - It is built from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Both are public client values;
    row-level security on the database is what protects data. A service role key must never be here.
  - The library is loaded with a dynamic import, so mock mode (the default) never downloads it.
  - PKCE flow (the browser proves it started the sign-in, so a stolen redirect code is useless).
    The OAuth callback is handled by useAuth, not by automatic URL detection, because the Connect
    page also uses a `?code=` query parameter for the device user code.
*/

import type { SupabaseClient } from "@supabase/supabase-js";
import { IS_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!IS_CONFIGURED) return Promise.reject(new Error("Sign-in is not configured for this dashboard."));
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }),
    );
  }
  return clientPromise;
}
