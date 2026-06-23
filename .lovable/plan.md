## Goal

Add a **Zone Admin** role alongside the existing **Main Admin** (super) so a user can be scoped to exactly one delivery zone. Main Admin keeps full cross-zone access; Zone Admin sees only their assigned zone's orders, analytics/dashboard, inventory view, and their own zone entry in Delivery Zones. Unauthorized navigation redirects to their zone dashboard with an "Access Restricted" toast. RLS enforces isolation server-side — UI guards alone are not enough.

## Database (one migration)

1. `ALTER TYPE app_role ADD VALUE 'zone_admin'`.
2. `ALTER TABLE user_roles ADD COLUMN assigned_zone_id uuid REFERENCES delivery_zones(id) ON DELETE SET NULL`.
   - Partial unique index: one zone_admin row per user.
   - Trigger: if `role = 'zone_admin'`, `assigned_zone_id` must be NOT NULL; for other roles it must be NULL.
3. Security-definer helpers (search_path = public):
   - `is_main_admin(uid uuid) returns boolean` — `has_role(uid, 'admin')`.
   - `get_user_zone(uid uuid) returns uuid` — assigned_zone_id of zone_admin row, else NULL.
   - `can_access_zone(uid uuid, zid uuid) returns boolean` — true if main admin, or zone_admin and `zid = assigned`.
   - `GRANT EXECUTE ... TO authenticated`.
4. RLS policy updates (drop & recreate; keep existing admin policies as `is_main_admin` checks):
   - `delivery_zones`: zone_admin can `SELECT` and `UPDATE` (fee_zar/min_order_zar/hours_text/active only — enforced via column grants + a `WITH CHECK` keeping name/slug unchanged) where `id = get_user_zone(auth.uid())`. Only main admin can `INSERT`/`DELETE`.
   - `orders`: zone_admin can `SELECT`/`UPDATE` where `delivery_zone_id = get_user_zone(auth.uid())`.
   - `order_items`: zone_admin can `SELECT` where parent order's zone matches.
   - `inventory_movements`: zone_admin can `SELECT` rows whose `order_id` belongs to their zone (NULL order_id rows hidden).
   - `products`/`categories`: zone_admin can `SELECT` (stock is global per current schema; read-only for them).
   - `user_roles`: only main admin can mutate; zone_admin can read only their own row.
   - `audit_logs`, `system_settings`, `integrations`, `discounts`, `promotions`, `banners`, `content_pages`, `featured_items`, `loyalty_*`, `reviews`, `reservations`, `store_hours`, `notifications`: main-admin-only writes; zone_admin no access (existing admin-only policies remain).

## Server functions

- `src/lib/admin/server-helpers.server.ts`: add `requireMainAdmin(supabase, userId)` and `getCallerZone(supabase, userId)` → `{ isMain: boolean, zoneId: string | null }`.
- Update zone-scopable server fns to enforce the scope (defense-in-depth on top of RLS):
  - `admin/orders.functions.ts` (list/get/update): inject zone filter if caller is zone_admin.
  - `admin/zones.functions.ts`: list returns only caller's zone for zone_admin; create/delete throw Forbidden; update allowed only for own zone.
  - `admin/analytics.functions.ts` + `admin-dashboard.functions.ts`: zone-filter all KPI queries when caller is zone_admin.
  - `admin/inventory.functions.ts`: read-only for zone_admin (block `adjust_product_stock` calls).
  - `admin/users.functions.ts` + `admin/roles.functions.ts`: main-admin-only; add `assignZoneAdmin(userId, zoneId)` and `revokeZoneAdmin(userId)`.

## Client / routing

- `src/lib/auth-context.tsx`: extend with `role: 'admin' | 'zone_admin' | 'user' | null`, `assignedZoneId: string | null`, `isMainAdmin`, `canAccessZone(id)`. Fetch on session change via a new `getCallerRole` server fn.
- New `src/components/admin/zone-admin-guard.tsx`: wraps admin routes; if caller is zone_admin and the route is global-only, `navigate('/admin')` + toast "Access Restricted — showing your zone".
- `src/routes/_authenticated/admin.tsx` (admin shell):
  - On mount, if zone_admin, force the global zone filter to their zone and lock the zone switcher (disabled select showing their zone name).
  - Hide nav items zone_admin shouldn't see: Users, Roles/Permissions, Audit, Integrations, Settings, Content, Promotions, Discounts, Reviews, Reservations, Loyalty. Keep: Dashboard, Orders, Delivery Zones (their zone only), Inventory (read), Analytics (their zone).
- Per-route guards using the new component:
  - `admin.users.tsx`, `admin.audit.tsx`, `admin.integrations.tsx`, `admin.settings.tsx`, `admin.content.tsx`, `admin.security.tsx`, `admin.notifications.tsx`, `admin.reviews.tsx`, `admin.reports.tsx`, `admin.categories.tsx`, `admin.products.tsx`: **main-admin only** → redirect.
  - `admin.delivery-zones.tsx`: render only the caller's zone card with edit (fee/min/hours/active); hide "Add Zone" and delete actions for zone_admin.
  - `admin.orders.tsx`: hide zone filter for zone_admin (show static badge); list already RLS-filtered.
  - `admin.analytics.tsx` / `admin.index.tsx`: show a "Viewing: <Zone>" badge for zone_admin.
- `admin.users.tsx` (main admin only): add a "Role" column with a row action **"Make Zone Admin"** that opens a dialog to pick one zone, and **"Revoke Zone Admin"**. Reflects in `user_roles`.

## Auth gate behavior

- Existing managed `_authenticated/route.tsx` handles sign-in.
- New behavior in admin shell: if `role` is neither `admin` nor `zone_admin`, redirect to `/` with toast "Admin access required".
- Zone Admins landing on `/admin` default to their zone dashboard (filter pre-applied) — never the global aggregate.

## Files

**New**
- `supabase/migrations/<ts>_zone_admin_role.sql`
- `src/components/admin/zone-admin-guard.tsx`
- `src/lib/admin/role-context.ts` (server fn `getCallerRole`)

**Edited**
- `src/lib/auth-context.tsx`
- `src/components/admin/admin-sidebar.tsx`
- `src/lib/admin/server-helpers.server.ts`
- `src/lib/admin/{orders,zones,analytics,inventory,users,roles}.functions.ts`
- `src/lib/admin-dashboard.functions.ts`
- `src/routes/_authenticated/admin.tsx` + the per-module admin route files listed above

## Security notes

- All zone scoping enforced in **RLS first**, server fns second, UI third. A compromised client cannot read another zone's data.
- Zone Admins cannot grant roles, cannot create/delete zones, cannot mutate products/inventory, cannot view audit/users/settings.
- Main Admin promotion still requires existing main admin to perform; no self-elevation path.
