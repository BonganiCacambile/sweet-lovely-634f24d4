# Admin Dashboard — Full Build Plan

You picked all four phases (in order) + new tables OK + CSV/Excel/PDF exports + realtime on Orders, Notifications, Inventory. I'll deliver in **4 phases**, each phase shipped and verified before the next starts. This avoids one giant unreviewable change that ends up half-broken.

## Shared foundation (built once at the start of Phase 1)

- **Audit logging helper** — server-side `logAudit(action, entity, entity_id, meta)` writing to existing `audit_logs`, called from every admin mutation.
- **Permissions** — new `app_permission` enum + `role_permissions` table + `has_permission(uid, perm)` security-definer function. `requireAdmin` / `requirePermission` server-fn middleware. UI gates buttons via a `usePermission` hook.
- **Realtime channel hook** — `useRealtimeTable(table, queryKey)` that subscribes once and invalidates the matching React Query keys. Used only for Orders, Notifications, Inventory per your choice. All other tables use `refetchOnWindowFocus`.
- **Reusable admin primitives** — `DataTable` (sorting, server-side pagination, search debounce, empty/loading/error states, mobile card fallback), `DateRangePicker`, `StatusBadge`, `ExportMenu` (CSV / XLSX via SheetJS / PDF via jsPDF + autotable).
- **Server-fn pattern** — every admin read/write is a `createServerFn` with `requireSupabaseAuth` + role/permission check; admin-bypass writes use `supabaseAdmin` imported inside `.handler()`.

## Phase 1 — Core commerce (this PR)

Tables: `products`, `categories`, `orders`, `order_items`, `reviews` already exist. Adds: `inventory_movements`, optional `product_images` (using existing `image_url` for now + array column if missing).

Modules:
1. **Orders** — list w/ search, status filter, date range, sort, pagination; detail drawer; status transitions (Pending → Processing → Completed / Cancelled / Refunded) with audit; refund action; realtime new-order toast.
2. **Products** — CRUD, category assignment, price, stock, availability toggle, image URL upload (Supabase Storage bucket `product-images` created via migration), search/filter, mini sparkline of sales.
3. **Categories** — CRUD, parent_id self-ref, drag-to-reorder via `sort_order`, visibility toggle, product counts.
4. **Inventory** — derived from `products.stock` + new `inventory_movements` ledger (type: restock/sale/adjustment, qty, reason, user, created_at). Low-stock threshold per product, low-stock realtime alerts, adjustment modal writes a movement + updates stock atomically via RPC.
5. **Reviews** — list, filter by status (pending/approved/rejected), moderate (approve/reject), per-product rating summary widget.

## Phase 2 — People & access

- **Users** — list from `auth.users` via admin API in server fn (joined to `profiles`), search, filter by role, suspend (ban_duration), activate, delete; profile drawer with order history, last_sign_in_at, created_at, role chips, activity from `audit_logs`.
- **Roles & Permissions** — UI to manage `user_roles` + new `role_permissions` matrix; assign roles to users; audit every change.
- **Audit Logs** — searchable/filterable table over existing `audit_logs`, export CSV/XLSX/PDF.

## Phase 3 — Insights

- **Analytics** — KPI cards (revenue, orders, AOV, new users, conversion if we have visits — otherwise order/user counts), revenue-over-time line, orders-by-status donut, top products bar, new-users line, date range filter, export. Recharts. Aggregated via SQL views or server fns with `GROUP BY date_trunc`.
- **Reports** — pre-built report templates (Revenue, Sales, Products, Customers, Inventory, Orders) + simple custom builder (pick entity + date range + group-by). Export CSV/XLSX/PDF.
- **Notifications Center** — uses existing `notifications` table; list/filter; new `notification_templates` table; "send notification" composer (in-app for now; email/SMS providers stubbed until Phase 4 integrations); realtime new-alert pings.

## Phase 4 — Platform

- **Content (CMS)** — new `content_pages` table (slug, title, body markdown, status draft/published/scheduled, publish_at, seo_title, seo_description, og_image); rich text via `@tiptap/react`; media upload to `content-media` storage bucket.
- **Integrations** — new `integrations` table (provider, status, config jsonb, last_tested_at); Paystack already wired — surface status + test ping; placeholders + key entry UI for email (Resend) and SMS (Twilio) that write to Secrets via guidance (we don't store secret values in DB).
- **Security Center** — MFA enroll/manage via supabase.auth.mfa.*, active sessions list (from supabase admin), login history + failed logins from `auth_logs` analytics view, password policy toggle (HIBP), trusted devices table.
- **System Settings** — new `system_settings` (key/value jsonb, singleton row per group) for branding (logo, colors), email-from, locale, business info, payment defaults, backup schedule. Logo upload to storage; theme tokens applied at runtime.

## What I need from you now

Approve this plan and I'll start with the **shared foundation + Phase 1 (Core commerce)** in the next turn. Phases 2–4 follow as separate PRs so each one stays reviewable.

## Out of scope / honest caveats

- "Email/SMS provider integrations" means we wire the config + test endpoint; actually sending requires you to provide Resend/Twilio API keys (Phase 4).
- "Backup settings" will configure a daily pg_dump-style export schedule trigger, but full DB dumps are not available on Lovable Cloud — only per-table CSV exports.
- "Push notifications" will be in-app realtime + email; web-push (service worker + VAPID) is a meaningful addition I'll flag if you want it.
- Conversion tracking needs a `page_views` / `sessions` table — I'll add a lightweight pageview logger in Phase 3 if you want true conversion %, otherwise "conversion" = orders / unique users in range.
