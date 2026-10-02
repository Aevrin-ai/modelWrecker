# Google sign-in setup (OAuth)

Google sign-in is handled through Supabase Auth, so Google redirects to Supabase, and
Supabase issues the identity (auth.uid()) that the API, dashboard, and CLI trust. You
never store Google passwords, and the Google token never enters the Docker engine.

Creating the OAuth client is a Google Cloud Console web step. Below are the exact values
to paste. Replace `<SUPABASE_PROJECT_REF>` with your Supabase project ref.

## Steps in Google Cloud Console

1. APIs and Services -> OAuth consent screen: configure (External), app name "Aevrin",
   support email, and add your email as a test user while in testing.
2. APIs and Services -> Credentials -> Create credentials -> OAuth client ID.
3. Application type: Web application.
4. Fill the two fields below.

### Authorized JavaScript origins

```text
https://app.aevrin.net
http://localhost:5173
http://localhost:5174
```

### Authorized redirect URIs

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

(For local Supabase only, if you run it: `http://localhost:54321/auth/v1/callback`.)

5. Create, then copy the Client ID and Client Secret into Supabase
   (Authentication -> Providers -> Google). See `deploy/supabase/README.md`.

## CLI device-code flow (later, Phase 10.4)

`modelwrecker login` uses an OAuth 2.0 device-code flow against app.aevrin.net, not a
browser redirect, so it needs no extra redirect URI here. It receives a short-lived,
scoped token, stored with 0600 permissions. The Google token itself never reaches the CLI
or the Docker engine.
