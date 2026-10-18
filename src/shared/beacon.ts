// first-party page analytics (docs/analytics/page-analytics.md): one cookie-free beacon per view, production host only
const PROD_HOST = "vyra.aevrin.ai";
let first = true;

// sends nothing under Do Not Track or Global Privacy Control; the referrer goes only with the first view of a visit
export function sendPageView(site: "landing" | "dashboard", path: string) {
  try {
    if (window.location.hostname !== PROD_HOST) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return;
    const body = JSON.stringify({ s: site, p: path.slice(0, 500), r: first ? document.referrer.slice(0, 1000) : "" });
    first = false;
    nav.sendBeacon?.("/api/v1/collect", body);
  } catch {
    // analytics must never break the page, so a failed beacon is dropped
    return;
  }
}
