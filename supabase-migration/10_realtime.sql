-- ============================================================
-- 10_realtime.sql  —  Realtime publication + replica identity
-- Sweet 'n Lovely Pizza :: fully idempotent (safe to re-run)
-- Run AFTER tables exist (02_tables.sql / 01_schema_public.sql)
-- ============================================================

-- 1. Ensure the publication exists (Supabase normally ships it).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2. Replica identity (FULL = old row values delivered on UPDATE/DELETE).

ALTER TABLE public.admin_presence REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.banners REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.content_pages REPLICA IDENTITY FULL;
ALTER TABLE public.discounts REPLICA IDENTITY FULL;
ALTER TABLE public.featured_items REPLICA IDENTITY FULL;
ALTER TABLE public.home_banners REPLICA IDENTITY FULL;
ALTER TABLE public.home_desserts REPLICA IDENTITY FULL;
ALTER TABLE public.home_hot_deals REPLICA IDENTITY FULL;
ALTER TABLE public.home_popular_items REPLICA IDENTITY FULL;
ALTER TABLE public.home_section_visibility REPLICA IDENTITY FULL;
ALTER TABLE public.home_specials REPLICA IDENTITY FULL;
ALTER TABLE public.integrations REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_movements REPLICA IDENTITY FULL;
ALTER TABLE public.loyalty_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.loyalty_programs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.product_sizes REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.promotions REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.reviews REPLICA IDENTITY FULL;
ALTER TABLE public.store_hours REPLICA IDENTITY FULL;
ALTER TABLE public.system_settings REPLICA IDENTITY FULL;
ALTER TABLE public.user_addresses REPLICA IDENTITY FULL;

-- pizza_toppings intentionally keeps DEFAULT replica identity (matches production).
ALTER TABLE public.pizza_toppings REPLICA IDENTITY DEFAULT;

-- 3. Add every realtime table to the publication, skipping any already a member.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_presence',
    'audit_logs',
    'banners',
    'categories',
    'content_pages',
    'discounts',
    'featured_items',
    'home_banners',
    'home_desserts',
    'home_hot_deals',
    'home_popular_items',
    'home_section_visibility',
    'home_specials',
    'integrations',
    'inventory_movements',
    'loyalty_accounts',
    'loyalty_programs',
    'notifications',
    'order_items',
    'orders',
    'pizza_toppings',
    'product_sizes',
    'products',
    'promotions',
    'reservations',
    'reviews',
    'store_hours',
    'system_settings',
    'user_addresses'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 4. Tables deliberately EXCLUDED from realtime (privacy / noise):
--    delivery_zones (contact-detail leak), profiles, user_roles,
--    role_permissions, home_content_events.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'delivery_zones','profiles','user_roles','role_permissions','home_content_events'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 5. Verification
--   SELECT tablename FROM pg_publication_tables
--    WHERE pubname='supabase_realtime' ORDER BY 1;   -- expect 29 rows
