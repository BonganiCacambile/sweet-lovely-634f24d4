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