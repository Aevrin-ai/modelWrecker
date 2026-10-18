/** Keep only scheme, host, port, and path of a target endpoint. Drops credentials and query strings. */
export function displayEndpoint(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return "";
  }
}
