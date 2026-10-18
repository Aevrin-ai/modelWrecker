// The message to show for a failed API response. No imports, so Node's test runner can load it directly.

const MAX_MESSAGE = 300;
const ERROR_CODE = /^[a-z0-9_]{1,64}$/i;
// a UUID, or a Cloudflare ray id such as 8a1b2c3d4e5f6789-SIN
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

const FALLBACK_MESSAGE: Record<number, string> = {
  400: "The request was not accepted.",
  403: "You do not have access to this.",
  404: "That record was not found.",
  409: "That conflicts with the current state. Refresh and try again.",
  410: "That has expired.",
  413: "The request was too large.",
  429: "Too many requests. Wait a moment and try again.",
};

export interface SafeError {
  code: string;
  message: string;
  requestId: string | null;
}

/** The code, message, and reference id to show for a failed response. Never the raw body. */
export function safeError(status: number, body: unknown, headerRequestId: string | null = null): SafeError {
  let code = `http_${status}`;
  let message = FALLBACK_MESSAGE[status] ?? (status >= 500 ? "The control plane had a problem. Try again shortly." : "The request failed.");
  let requestId = validRequestId(headerRequestId);
  if (body && typeof body === "object") {
    const fields = body as Record<string, unknown>;
    if (typeof fields.error === "string" && ERROR_CODE.test(fields.error)) code = fields.error;
    if (typeof fields.message === "string" && fields.message.trim()) message = fields.message.trim().slice(0, MAX_MESSAGE);
    requestId = validRequestId(fields.requestId) ?? requestId;
  }
  // only a server error needs a reference; a 4xx message already says what to change
  if (status >= 500 && requestId) message = `${message} Reference: ${requestId}.`;
  return { code, message, requestId };
}

function validRequestId(value: unknown): string | null {
  return typeof value === "string" && REQUEST_ID.test(value) ? value : null;
}
