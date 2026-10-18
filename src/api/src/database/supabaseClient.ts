import { createFetch, SUPABASE_POLICY } from "../lib/http";

// every call to Supabase gets a time budget, and a read that fails for a passing reason is tried once more
export const supabaseFetch = createFetch(SUPABASE_POLICY);

/** Client options for a server-side Supabase client: no stored session, and the timed fetch. */
export const NO_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: supabaseFetch },
};
