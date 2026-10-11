// Checks, and with --apply sets, the Supabase Auth settings the dashboard's token lifecycle relies on
// (docs/security/authentication.md). Uses the Supabase Management API with your own personal access token.
//
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node deploy/supabase/auth-settings.mjs [--apply]
//
// Prints setting names and values only, never the token. Without --apply it changes nothing.

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !/^[a-z0-9]{20}$/.test(ref ?? "")) {
  console.error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (the 20-letter project id).");
  process.exit(2);
}

/** name -> [is the current value fine, the value --apply sets, why] */
const WANTED = {
  jwt_exp: [(v) => v > 0 && v <= 3600, 3600, "access token lifetime in seconds: short-lived"],
  refresh_token_rotation_enabled: [(v) => v === true, true, "each refresh token works once"],
  security_refresh_token_reuse_interval: [(v) => v === 10, 10, "seconds a just-rotated token still works, for tabs refreshing together; reuse after it revokes the session"],
  // Every refresh reaches Supabase Auth from the API Worker, so this per-address limit is shared by all
  // users. The API keeps its own per-visitor limit (src/api/src/routes/auth.ts).
  rate_limit_token_refresh: [(v) => v >= 1800, 1800, "refreshes per 5 minutes per address; all users share the Worker's"],
};

const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const res = await fetch(url, { headers });
if (!res.ok) {
  console.error(`Reading the Auth settings failed: HTTP ${res.status}.`);
  process.exit(1);
}
const config = await res.json();

const changes = {};
for (const [name, [ok, wanted, why]] of Object.entries(WANTED)) {
  const value = config[name];
  const fine = ok(value);
  if (!fine) changes[name] = wanted;
  console.log(`${fine ? "OK    " : "CHANGE"} ${name} = ${JSON.stringify(value)}${fine ? "" : ` (want ${JSON.stringify(wanted)})`}  - ${why}`);
}

if (!Object.keys(changes).length) {
  console.log("All settings are as required.");
} else if (!process.argv.includes("--apply")) {
  console.log("Run again with --apply to set the values marked CHANGE.");
  process.exit(1);
} else {
  const patch = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(changes) });
  if (!patch.ok) {
    console.error(`Updating the Auth settings failed: HTTP ${patch.status}.`);
    process.exit(1);
  }
  console.log(`Updated: ${Object.keys(changes).join(", ")}.`);
}
