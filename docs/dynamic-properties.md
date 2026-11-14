# Dynamic properties: local implementation

The homepage now fetches `/api/properties`; the Vercel entry is
`api/properties.mjs` and server queries live in `lib/properties.cjs`. No browser
Supabase client or credentials are served. The existing diagnostic remains
available separately.

## Local preview

With dependencies installed and the ignored `.env.local` configured:

```powershell
node --env-file=.env.local scripts/dev.cjs
```

Open http://127.0.0.1:3000. `npm run dev` is equivalent when npm is available.
Opening index.html directly or using a static-only file server will not provide
the API. The local server serves only the homepage, robots/sitemap and assets;
`.env.local`, Git metadata, dependencies and server sources are not served.

## Queries

All queries use `public.properties`, `is_published=true`, the publishable key and
no user JWT/session. There are no write operations or permission modifications.
Only GET is accepted, errors are sanitized, and responses use `Cache-Control:
no-store`. URL and key must already be configured on the target environment;
only Production was previously configured in Vercel, so a future Preview needs
its own configuration before it can read listings. No settings are changed here.
The API accepts the project root URL and safely normalizes an existing
`/rest/v1` suffix to that origin in memory; no environment file is rewritten.

List parameters: `page` (1-based, 12 rows/page), `q`, `city`, `type`, `minPrice`,
`maxPrice`, `beds`, `baths`, `sort` (`latest`, `price-asc`, `price-desc`). Filtering
and stable ordering precede database range pagination; exact count supplies
total pages. Searches are not limited to the initially loaded page or the
default 1,000-row response cap. The separate `?facets=1` query pages through all
published city/type rows, respecting actual returned counts if the server cap
is lower than the requested batch size.

Public return fields: `id`, `created_at`, `title`, `city`, `township`,
`property_type`, `price`, `bedrooms`, `bathrooms`, `land_size`, `listing_type`.
`bank_value`, unpublished rows, raw errors and credentials are excluded.
Keyword searches match title/city/township/description; text is safely quoted
for PostgREST. Database text is rendered through DOM textContent.

## Inspected schema limitations

The real published row inspection confirmed 15 fields but **no photo or detail
URL field**. The UI therefore shows a local "Photo not supplied" placeholder
and contacts Joel on WhatsApp using the actual title/id. No unrelated image or
old external listing URL is assigned to a database row. To display real photos,
an explicit photo source/relationship must be supplied in a separately approved
task; no image column is guessed or added here.

`land_size` is a string without an explicit unit on the inspected row. Its
contents are displayed verbatim as land area, without inventing sqft, built-up
area or a computed size. The property type is also taken verbatim (the inspected
row is `Double Storey`), and filter options come from actual published values.

Loading, empty results, retryable service errors, unavailable filter choices,
reversed price validation and request cancellation are handled explicitly.
Address search clears previous quick-search conditions. Data is refreshed when
the page loads or the user searches, sorts or changes page; no realtime
subscription or background polling is added.

## Verification

- `npm test` (or `node --test tests/*.test.cjs`) runs API, SDK and local-server
  tests, including page 109 of 1,305 records, unpublished filtering, lower row
  caps, input validation and redaction.
- `node scripts/check-mobile.cjs` uses the real SDK/API and a deterministic
  fixture transport, with 27 published and one unpublished record. It checks
  responsive layouts, menu/desktop hover, searches beyond page one, sorting,
  pagination, errors/retry, loading, no-results and racing requests.
- A local real-database API check returned HTTP 200 for published lists,
  combined filters and choices, with one published record visible anonymously.
  This verifies effective anonymous read, not RLS policy internals.

Homepage metadata, robots.txt and sitemap.xml are preserved. No commit, push,
deployment, Supabase record write or RLS change is performed in this task.
