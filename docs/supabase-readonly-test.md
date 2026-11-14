# Supabase anonymous read diagnostic

The isolated Node.js diagnostic uses the official npm SDK. The homepage does
not import this diagnostic. The later dynamic-listing implementation is
documented in `dynamic-properties.md`; it uses its own read-only listing API.
There is no public diagnostic endpoint or database migration.

## Configuration

Use the same `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` configured for the
Vercel project `joeltanpropertymy-vto1`. Supply them as process environment
variables or in the ignored `.env.local` file. `.env.example` contains names
only. Never paste real values into code, Git, logs, or chat. The diagnostic
accepts only `sb_publishable_` keys and rejects secret/service-role/legacy keys.
It never signs in or creates an anonymous Auth account.

Vercel currently scopes these variables to Production. Sensitive values cannot
be read back through the current Vercel connection, and the URL was returned
encrypted. The local diagnostic needs an authorized local copy; do not deploy a
new endpoint just to retrieve the values. This work does not change Vercel
environment scopes or settings.

## Run locally

Requires Node.js >=22.9 and npm:

```powershell
npm ci --ignore-scripts
npm test
npm run supabase:check
```

On the current computer, npm is not on PATH. Dependencies were installed with a
temporary, integrity-checked npm CLI in the ignored `.tools` directory. With
dependencies installed, the equivalent commands are:

```powershell
node --test tests/supabase-connection.test.cjs
node --env-file-if-exists=.env.local scripts/check-supabase.cjs
node scripts/check-mobile.cjs
```

The Supabase command makes one GET to `/rest/v1/properties?select=*&limit=1`
with the `public` schema, publishable key, and no user Authorization token.
There are no retries, writes, Auth requests, RPCs, session persistence, or admin
credentials. Requests have a 10-second timeout and redirects are rejected.
Output contains outcome, HTTP/database code, row count and column names only;
no credentials or row values are printed.

## Interpret the result

| Outcome | Meaning |
| --- | --- |
| `row_read` (exit 0) | A single row is visible to an unauthenticated caller using the configured publishable key. |
| `empty_or_filtered` (exit 2) | The query succeeded with no visible row. The table may be empty or policies may filter all rows; anonymous read is not verified. |
| `permission_denied` (exit 1) | Check schema/table SELECT grants and RLS policies. Nothing is changed automatically. |
| `authentication_failed` (exit 1) | Check project URL and publishable key pairing/validity. |
| `configuration_error` (exit 1) | Missing/unsupported key or invalid project URL. No request is sent. |
| `table_or_schema_unavailable` (exit 1) | Check the table exists and is exposed by the Data API. |
| `network_or_timeout` (exit 1) | Check DNS, network access, project availability, or timeout. |

A successful anonymous read does **not** prove RLS is enabled, that policies
restrict reads to public listings, or that writes are blocked. The diagnostic
reports `rlsPolicyInspected: false`. It cannot independently label a row
"public" without reviewing the project's visibility column and policy rules.
No negative write test is performed because the task is strictly read-only.

If a policy audit is needed, an authorized project owner can inspect the
following read-only statements in Supabase SQL Editor; they are provided for
review and are not executed by this script:

```sql
SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'properties';

SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'properties';

SELECT has_schema_privilege('anon', 'public', 'USAGE') AS anon_schema_usage,
       has_table_privilege('anon', 'public.properties', 'SELECT') AS anon_select;
```

## Verification coverage

`npm test` uses the real SDK against an in-memory local HTTP fixture, with a
non-secret dummy key. It verifies one GET/one-row limit, the public schema, no
user token, redacted row data/errors, empty results, permission denial, invalid
keys, administrator-key rejection, missing configuration, and no network retry.
It is not evidence of a successful connection to the actual Supabase project.

The existing mobile/browser check is retained without changes. No commit,
push, merge, deployment, database record change or RLS change is authorized
as part of this branch.

References: [Supabase initialization](https://supabase.com/docs/reference/javascript/initializing),
[query limit](https://supabase.com/docs/reference/javascript/limit),
[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
