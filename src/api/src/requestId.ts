// Cloudflare ray id when well formed (it finds the request in Cloudflare); else a fresh UUID.

// "8a1b2c3d4e5f6789-SIN": 16 hex digits, then the data centre code
const CF_RAY = /^[0-9a-f]{16}(-[A-Z]{3})?$/;

export function requestIdFor(request: Request): string {
  const ray = request.headers.get("cf-ray");
  if (ray && CF_RAY.test(ray)) return ray;
  return crypto.randomUUID();
}
