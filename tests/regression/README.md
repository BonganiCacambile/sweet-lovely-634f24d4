# Realtime Orders Regression Test

End-to-end regression that proves a newly inserted customer order shows up in
the admin **Orders** dashboard in real time, without any page refresh.

## What it does

1. Signs in as an existing admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)
   against the running app, then loads `/admin/orders` once.
2. Snapshots the current order rows.
3. Inserts a brand-new order directly into the database with the service
   role key — simulating a customer checkout — using a unique
   `order_number` like `REGR-<timestamp>`.
4. Polls the **already-loaded** Orders table (no reload, no router
   navigation) for up to 20s, expecting the new `order_number` to appear
   via the realtime subscription.
5. Cleans up: deletes the test order.

The test fails if the new row does not appear without a refresh, which is
exactly the regression we shipped fixes for.

## Required env vars

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Base URL of the running app (default `http://localhost:8080`) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) — used to insert/delete the test order |
| `ADMIN_EMAIL` | Email of a user with the `admin` role |
| `ADMIN_PASSWORD` | Password for that admin |

## Run

```bash
bun add -d playwright @supabase/supabase-js   # if not already installed
node tests/regression/realtime-orders.mjs
```

Exit code `0` = pass, non-zero = fail (with a screenshot under
`tests/regression/artifacts/`).