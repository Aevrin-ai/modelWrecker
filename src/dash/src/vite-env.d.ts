/// <reference types="vite/client" />

/*
  Build-time settings. All of these are PUBLIC values baked into the bundle.
  Never put a server key (for example the Supabase service role key) in a VITE_ variable.
*/
interface ImportMetaEnv {
  /** "http" uses the real control-plane API. Anything else (the default) uses mock data. */
  readonly VITE_API_MODE?: string;
  /** Base URL of the control-plane API. Defaults to "/api/v1" on the same origin. */
  readonly VITE_API_BASE?: string;
  /** Supabase project URL (public). Required in http mode. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon key (public; row-level security protects the data). Required in http mode. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
