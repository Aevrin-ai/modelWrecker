// the Worker's settings: plain vars in wrangler.toml, secrets set with `wrangler secret put` (deploy/cloudflare/README.md)
export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_ORIGIN: string;
  // stays https://app.aevrin.net (the default) after the browser origin moves: shipped engines trust only it
  ENTITLEMENT_ISSUER?: string;
  // billing secrets; without the key pair, billing routes answer 503
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  // entitlement signing: the private key is a secret; the key id and public key are public vars
  ENTITLEMENT_SIGNING_KEY?: string;
  ENTITLEMENT_KEY_ID?: string;
  ENTITLEMENT_PUBLIC_KEY?: string;
  // encrypts admin authenticator secrets at rest
  ADMIN_TOTP_KEY?: string;
  // mixed into the daily page-analytics visitor hash
  ANALYTICS_SALT?: string;
}
