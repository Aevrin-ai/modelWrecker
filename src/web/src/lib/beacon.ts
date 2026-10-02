/*
  First-party page analytics (docs/analytics/page-analytics.md). One small beacon per page view to our own
  API, only on the production host. No cookie, no storage, no third-party script. Ids in the path are
  replaced on the server; the referrer is sent only with the first view of a visit and reduced to a host.
  Browsers with Do Not Track or Global Privacy Control send nothing.
*/

const PROD_HOST = "app.aevrin.net";
let first = true;

export function sendPageView(site: "landing" | "dashboard", path: string) {
  try {
    if (window.location.hostname !== PROD_HOST) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.doNotTrack === "1" || nav.globalPrivacyControl === true) return;
    const body = JSON.stringify({ s: site, p: path.slice(0, 500), r: first ? document.referrer.slice(0, 1000) : "" });
    first = false;
    nav.sendBeacon?.("/api/v1/collect", body);
  } catch {
    /* analytics must never break the page */
  }
}
