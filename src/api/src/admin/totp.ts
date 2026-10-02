// Authenticator codes (TOTP, RFC 6238) and at-rest encryption for the admin console (issue #43).
// Standard parameters every authenticator app understands: SHA-1, 6 digits, 30-second steps.
// The shared secret is stored only encrypted with AES-256-GCM under the Worker secret ADMIN_TOTP_KEY.

const STEP_S = 30;
const DIGITS = 6;
/** Accept the previous and next step too, for clock drift between phone and server. */
const WINDOW = 1;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** A new random 160-bit secret, base32 (the form authenticator apps take). */
export function newTotpSecret(): string {
  const buf = new Uint8Array(20);
  crypto.getRandomValues(buf);
  return base32Encode(buf);
}

async function hotp(secret: Uint8Array, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export const stepAt = (nowMs: number) => Math.floor(nowMs / 1000 / STEP_S);

/** The code for a given time. Used by tests and by nothing else. */
export async function totpAt(secretB32: string, nowMs: number): Promise<string> {
  return hotp(base32Decode(secretB32), stepAt(nowMs));
}

/**
 * Check a 6-digit code. Returns the matching step, or null. A step at or before `lastStep` is refused, so
 * a code (or an older one) can never be used twice.
 */
export async function verifyTotp(secretB32: string, code: string, nowMs: number, lastStep: number): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretB32);
  const now = stepAt(nowMs);
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const step = now + d;
    if (step <= lastStep) continue;
    const expected = await hotp(secret, step);
    let diff = 0;
    for (let i = 0; i < DIGITS; i++) diff |= expected.charCodeAt(i) ^ code.charCodeAt(i);
    if (diff === 0) return step;
  }
  return null;
}

export function otpauthUri(secretB32: string, account: string, issuer = "Aevrin Admin"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_S}`;
}

// --- AES-256-GCM for secrets at rest ---------------------------------------------------------------

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(keyB64: string): Promise<CryptoKey> {
  const raw = unb64(keyB64.trim());
  if (raw.length !== 32) throw new Error("ADMIN_TOTP_KEY must be 32 bytes, base64");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** `base64(iv) "." base64(ciphertext)`. A fresh 96-bit IV for every encryption. */
export async function encryptSecret(keyB64: string, plain: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(keyB64), new TextEncoder().encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function decryptSecret(keyB64: string, sealed: string): Promise<string> {
  const [iv, ct] = sealed.split(".");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(keyB64), unb64(ct));
  return new TextDecoder().decode(plain);
}
