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

---

# Realtime Customer Notifications Regression Test

File: `tests/regression/realtime-customer-notifications.mjs`

Proves that when an order is created for a signed-in customer, that customer
sees the alert **instantly** without any page refresh:

1. A sonner toast titled "Order received" appears.
2. The notification bell's unread badge increments by exactly 1.
3. A matching row exists in `public.notifications` scoped to the customer's `user_id`.

## What it does

1. Signs in as `CUSTOMER_EMAIL` / `CUSTOMER_PASSWORD` and captures the session + user id.
2. Launches a browser, seeds the Supabase session into `localStorage`, loads the homepage.
3. Waits for the `NotificationBell` to render and records the current unread badge count.
4. Inserts an order with `user_id = <customer>` via the service role — the
   `notify_customer_on_new_order` trigger writes the notification row, which is
   broadcast over Realtime to the open browser tab.
5. Asserts the toast appears, the badge increments, and no navigation occurred.
6. Re-reads `public.notifications` to confirm the row is persisted, unread, and
   bound to the right user.
7. Cleans up the order and the trigger-generated notification.

## Required env vars

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Base URL of the running app (default `http://localhost:8080`) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key — for the customer sign-in |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — for inserting the test order and cleanup |
| `CUSTOMER_EMAIL` | Email of a regular customer user (no admin role required) |
| `CUSTOMER_PASSWORD` | Password for that customer |

## Run

```bash
node tests/regression/realtime-customer-notifications.mjs
# or
bun run test:regression:notifications
```

---

# Employee Presence + Activity Feed Performance Regression

File: `tests/regression/admin-presence-perf.mjs`

Asserts the newly added Employee Presence Monitoring page and Activity
Feed load fast and stay responsive — no lag, no slow server functions,
no realtime delay.

Checks (all configurable via env):

| Budget | Default | Env var |
| --- | --- | --- |
| Cold + warm load of `/admin/employee-activity` | 4000 ms | `PAGE_BUDGET_MS` |
| `listAdminPresence` server fn round-trip | 1500 ms | `SERVER_FN_BUDGET_MS` |
| `listActivityFeed` server fn round-trip | 1500 ms | `SERVER_FN_BUDGET_MS` |
| Realtime feed update after an `audit_logs` insert | 5000 ms | `REALTIME_BUDGET_MS` |

Required env: same as the orders regression (`APP_URL`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`).

## Run

```bash
node tests/regression/admin-presence-perf.mjs
# or
bun run test:regression:presence-perf
```

---

# Home Route Performance Regression

File: `tests/regression/home-perf.mjs`

Asserts the two perf fixes shipped for `/` stay in place and that LCP / TTI
do not regress against a stored baseline:

1. The route loader prefetches `home-content` + active zones server-side —
   verified by (a) home content strings appearing in the raw SSR HTML and
   (b) zero `getHomeContent` server-fn calls fired from the client during
   the initial load.
2. The hero (LCP) image ships with a `<link rel="preload" as="image"
   fetchpriority="high">` in the SSR head pointing at the same asset as
   the rendered `<img>`.

On top of the structural checks it captures LCP, `domInteractive`, and
TTFB via the Performance API, compares them to
`tests/regression/artifacts/home-perf-baseline.json`, and fails on
regression beyond `REGRESSION_TOLERANCE_PCT` (default 25%). Absolute
budgets act as hard ceilings on the first run.

| Budget | Default | Env var |
| --- | --- | --- |
| LCP | 2500 ms | `LCP_BUDGET_MS` |
| domInteractive (TTI proxy) | 3000 ms | `TTI_BUDGET_MS` |
| TTFB | 800 ms | `TTFB_BUDGET_MS` |
| Regression tolerance vs baseline | 25% | `REGRESSION_TOLERANCE_PCT` |

The baseline auto-ratchets: any run with a better LCP than the stored one
overwrites the file. Force a refresh with `UPDATE_BASELINE=1`.

## Run

```bash
node tests/regression/home-perf.mjs
# or
bun run test:regression:home-perf

# refresh the baseline after an intentional perf change:
UPDATE_BASELINE=1 node tests/regression/home-perf.mjs
```

---

# Home Route Performance Regression — Mobile

File: `tests/regression/home-perf-mobile.mjs`

Same structural + metric checks as `home-perf.mjs`, but run under a mobile
emulation profile (Playwright's `iPhone 13` descriptor: 390×844 viewport,
DPR 3, touch, mobile UA). Mobile is where the hero image preload and
SSR loader prefetch have the biggest impact on LCP and TTI, so it gets
its own baseline at
`tests/regression/artifacts/home-perf-mobile-baseline.json` and looser
absolute budgets to account for slower mobile CPU/network.

| Budget | Default | Env var |
| --- | --- | --- |
| LCP | 3500 ms | `LCP_BUDGET_MS` |
| domInteractive (TTI proxy) | 4000 ms | `TTI_BUDGET_MS` |
| TTFB | 1000 ms | `TTFB_BUDGET_MS` |
| Regression tolerance vs baseline | 25% | `REGRESSION_TOLERANCE_PCT` |

In addition to the desktop checks, the mobile variant asserts the emulated
viewport is actually mobile-sized (<768px) so future layout regressions
that force a desktop breakpoint are caught.

## Run

```bash
node tests/regression/home-perf-mobile.mjs
# or
bun run test:regression:home-perf-mobile

UPDATE_BASELINE=1 node tests/regression/home-perf-mobile.mjs
```