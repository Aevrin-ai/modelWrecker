// Small shared helpers: tokens and hashing, best-effort rate limiting, Wilson interval.

// errors live in errors.ts; re-exported so every existing `import { ApiError } from "./lib"` keeps working
/** Unpadded base64url. Builds the string byte by byte, so large inputs do not overflow the call stack. */
export const b64url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};


/** A random URL-safe token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return b64url(buf);
}


/** Hex SHA-256. Tokens and device codes are stored only as this hash. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}


// RFC 8628 section 6.1: consonants only, so a code never spells a word or confuses 0/O or 1/I.
const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";


export function userCode(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  const chars = [...buf].map((b) => USER_CODE_ALPHABET[b % USER_CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}


export const DEVICE_TOKEN_PREFIX = "mwd_";


export function bearer(header: string | undefined | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
