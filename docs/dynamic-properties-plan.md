# Dynamic published properties

Implement on the existing isolated `codex/supabase-readonly-test` branch. No push,
deployment, database mutation, permission change, or administrator key.

- Use a Vercel Web handler at `/api/properties` backed by a shared server module.
- Query `public.properties` with `is_published=true`, a public field allowlist,
  exact filtered count, stable sorting and database range pagination (12/page).
- Load real city/type choices separately, paging through all published facet
  rows so options are not restricted to the first result page.
- Replace DOM-based filtering with an external frontend controller, preserving
  existing card classes, controls, responsive CSS and floating navigation.
- The inspected schema has no image or external-detail URL field. Show a local
  missing-photo placeholder and a property-specific WhatsApp contact link.
  Display land_size verbatim and do not assume an area unit.
- Use textContent for database strings, GET-only server access, strict input
  validation, no-store responses, sanitized errors, and latest-request wins UI.
- Add API tests with the real SDK and fixture transport, pagination beyond 1,000
  records, missing/denied configuration, and browser loading/error/retry checks.
  Test the local API against the real database read-only before completion.

Live preflight: anonymous published-row SELECT returned HTTP 200, one published
row, and total published count 1. No RLS error was returned; RLS policy internals
were not inspected. Homepage title/meta/canonical and robots/sitemap stay intact.
