-- ============================================================================
-- Sweet 'n Lovely Pizza — Database Migration
-- 06_indexes.sql  —  Non-constraint indexes (public + private schemas)
-- ----------------------------------------------------------------------------
-- Fully idempotent: safe to run repeatedly. Every statement uses
-- CREATE INDEX IF NOT EXISTS, so pre-existing indexes (e.g. created inline by
-- 02_tables.sql) will NOT raise "relation ... already exists" (42P07).
--
-- Indexes that back PRIMARY KEY / UNIQUE constraints are intentionally omitted:
-- they are created by 03_constraints.sql together with their constraints.
--
-- Run order: 00 -> 01 -> 02 -> 03 -> 04(data) -> 05(foreign keys) -> 06(indexes)
-- ============================================================================

SET search_path = public;

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_created
  ON public.audit_logs USING btree (created_at DESC);

-- ---------------------------------------------------------------------------
-- discounts
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS discounts_target_idx
  ON public.discounts USING btree (target_type, target_slug);

-- ---------------------------------------------------------------------------
-- home_content_events
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_home_events_recent
  ON public.home_content_events USING btree (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_home_events_target
  ON public.home_content_events USING btree (content_type, content_id);

-- ---------------------------------------------------------------------------
-- inventory_movements
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created
  ON public.inventory_movements USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product
  ON public.inventory_movements USING btree (product_slug, created_at DESC);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications USING btree (user_id, read, created_at DESC);

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items USING btree (order_id);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created
  ON public.orders USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders USING btree (status);

CREATE INDEX IF NOT EXISTS idx_orders_user
  ON public.orders USING btree (user_id);

CREATE INDEX IF NOT EXISTS orders_delivery_zone_id_idx
  ON public.orders USING btree (delivery_zone_id);

-- Partial unique index (not a table constraint): one Paystack reference per order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_paystack_reference_key
  ON public.orders USING btree (paystack_reference)
  WHERE (paystack_reference IS NOT NULL);

-- ---------------------------------------------------------------------------
-- product_sizes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_sizes_product_slug_idx
  ON public.product_sizes USING btree (product_slug, sort_order);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products USING btree (category_slug);

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reservations_reserved_at_idx
  ON public.reservations USING btree (reserved_at);

CREATE INDEX IF NOT EXISTS reservations_user_idx
  ON public.reservations USING btree (user_id);

-- ---------------------------------------------------------------------------
-- user_addresses
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_addresses_user
  ON public.user_addresses USING btree (user_id, is_default DESC, created_at DESC);

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
-- Partial unique index: a user may hold at most one zone-scoped admin role.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_zone_admin_unique
  ON public.user_roles USING btree (user_id)
  WHERE (assigned_zone_id IS NOT NULL);

-- ============================================================================
-- Verification (optional)
-- ============================================================================
-- SELECT schemaname, tablename, indexname
--   FROM pg_indexes
--  WHERE schemaname IN ('public','private')
--  ORDER BY tablename, indexname;
-- Expected: 19 non-constraint indexes listed above, plus constraint-backed ones.
-- ============================================================================
