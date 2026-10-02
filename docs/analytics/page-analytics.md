# Page analytics

> The admin console's Page analytics view (issue #45). How staff use it: [`../security/admin.md`](../security/admin.md).
> This page is the single source of truth for what the landing page and the dashboard record about visits.

## Purpose

Know how many people visit the landing page and use the dashboard, which pages, and where visitors come
from, without a third-party tracker and without collecting personal data.

## What is sent

One small beacon per page view, from `src/web` (each load) and `src/dash` (each route), to our own API at
`POST /api/v1/collect`, only on `app.aevrin.net`. The admin console sends nothing.

```json
{ "s": "dashboard", "p": "/dashboard/campaigns/<id>", "r": "https://www.google.com/search?q=..." }
```

The referrer is sent only with the first view of a visit.

## What is stored

| Column | Value |
|--------|-------|
| `day`, `ts` | when |
| `site` | `landing` or `dashboard` |
| `path` | the path without query string or fragment; ids become `:id` |
| `referrer` | the referring host only (`google.com`), or nothing for direct visits and our own pages |
| `country` | the two-letter country from Cloudflare's edge |
| `device` | desktop, mobile, or tablet, from the user agent |
| `visitor` | SHA-256 of a server secret, the day, the IP address, and the user agent, cut to 32 hex characters |

**Not stored**: the IP address, the user agent, cookies, query strings, full referrer URLs, or anything
that links a visitor across days. The visitor hash changes every day and cannot be reversed or compared
without the Worker secret `ANALYTICS_SALT`.

## What is not counted

- Browsers that send Do Not Track (`DNT: 1`) or Global Privacy Control (`Sec-GPC: 1`). The pages check
  this too and do not send a beacon.
- Obvious bots and scripts (by user agent), requests without an address or user agent, more than 60
  beacons a minute from one address, and malformed bodies.

The endpoint always answers `204`, so a beacon never shows an error or reveals whether it was counted.

## Retention

Page views older than 400 days are deleted by the daily upkeep job.

## Security considerations

- `page_views` has RLS on and no policies: only the API's server key reads or writes it, and only the
  admin console (staff, authenticator, session) can query the aggregates.
- No consent banner is needed for this design because nothing is stored on the visitor's device and no
  personal data is kept; review this if the design changes.
