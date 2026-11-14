# Phase 1 property details

Homepage image, title and bottom card links open `/property.html?id=1` in the
same tab. The homepage markup, stylesheet, filters, sorting and pagination are
unchanged in this phase; only the card links/title anchor are changed in
`assets/js/properties.js`.

The independent page uses `assets/js/property-details.js` and
`assets/css/property-details.css`. The stylesheet includes a snapshot of the
existing site rules followed by scoped detail rules, leaving index.html and its
layout untouched. Header/floating link markup and the existing brand/phone are
reused. The detail page has a photo placeholder, title, location, price, facts,
description, reference, back link and WhatsApp CTA with the actual title/id.
No photo data or area unit is invented.

`api/property.mjs` exposes a GET-only handler backed by `handleProperty` in
`lib/properties.cjs`. It accepts one positive numeric ID within JavaScript's safe
integer range, matching the current numeric ID schema. Other parameter names,
duplicate IDs, unsafe/invalid IDs and write methods are rejected. The query is
`public.properties`, with both `is_published=true` and the exact ID, limited to
one row. It returns the existing public list field allowlist plus `description`.
It never returns bank_value, credentials, raw database errors or an unpublished
row. Missing and unpublished IDs both return the same 404 response.

The UI handles loading, invalid IDs, missing/unpublished properties, service
errors/retry and absent optional values. Description and all database strings
use textContent. Invalid/not-found/error states remain noindex. Successful
client rendering updates title, description and canonical URL. This static
phase does not provide server-rendered per-property social previews or a
dynamic sitemap; those can be a later SEO task.

Run the existing local preview command:

```powershell
node --env-file=.env.local scripts/dev.cjs
```

Open http://127.0.0.1:3000 and click a listing. Restart an older running preview
process after server code changes so the new `/api/property` and property.html
routes are loaded. Direct refresh of property.html?id=1 is supported locally.
No deployment/routing setting change is required for the query-string URL.
The local server now sends `Cache-Control: no-store` for pages/assets, and HTML
references versioned listing/detail scripts and styles. Already-open tabs still
need a browser refresh after edits because this static server has no hot reload.

Verification includes API public/absent/unpublished/invalid/permission cases,
local page/API routing, 320/375/390/430/620/768/1440px browser tests, same-tab
card-link targets, description escaping, WhatsApp URLs, floating-menu behavior,
service error/retry and homepage regression checks. Actual anonymous read of
an existing published property returned HTTP 200, with description and no
internal bank_value/key exposure. RLS policies were not altered or audited.

No Supabase schema/data/RLS modification, commit, push or deployment is part of
this phase. Actual multiple photos still require an approved data source.
