
-- =========================================================
-- 1) Notifications: remove user self-insert branch
-- =========================================================
DROP POLICY IF EXISTS "notifications admin insert" ON public.notifications;
CREATE POLICY "notifications admin insert"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role('admin'::app_role));

-- =========================================================
-- 2) Orders: require non-null user_id on user inserts
-- =========================================================
DROP POLICY IF EXISTS "orders user insert own" ON public.orders;
CREATE POLICY "orders user insert own"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id IS NOT NULL AND auth.uid() = user_id)
    OR private.has_role('admin'::app_role)
  );

-- =========================================================
-- 3) Delivery zones: hide staff contact columns from anon
-- =========================================================
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM anon;

-- =========================================================
-- 4) Realtime messages: deny anon/authenticated subscriptions
-- =========================================================
DROP POLICY IF EXISTS "deny anon realtime subscriptions" ON realtime.messages;
DROP POLICY IF EXISTS "deny authenticated realtime subscriptions" ON realtime.messages;

CREATE POLICY "deny anon realtime subscriptions"
  ON realtime.messages
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "deny authenticated realtime subscriptions"
  ON realtime.messages
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- =========================================================
-- 5) SECURITY DEFINER functions: move RLS helpers to private
--    schema and revoke EXECUTE on public-schema copies from
--    anon/authenticated. Functions used only server-side via
--    the service role have EXECUTE revoked entirely from
--    anon/authenticated.
-- =========================================================

-- Private mirrors of helpers (callable only by superuser/owner via
-- SECURITY DEFINER inside policies; private schema is not exposed
-- to PostgREST so the linter no longer flags them).
CREATE OR REPLACE FUNCTION private.is_main_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION private.get_user_zone(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.is_zone_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION private.has_role(_uid uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND role = _role
  )
$$;

-- Rewrite policies that referenced unqualified (public) helpers
-- so they call the private-schema equivalents.

-- orders zone-admin policies
DROP POLICY IF EXISTS "Zone admin reads zone orders" ON public.orders;
CREATE POLICY "Zone admin reads zone orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (delivery_zone_id IS NOT NULL AND delivery_zone_id = private.get_user_zone(auth.uid()));

DROP POLICY IF EXISTS "Zone admin updates zone orders" ON public.orders;
CREATE POLICY "Zone admin updates zone orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (delivery_zone_id IS NOT NULL AND delivery_zone_id = private.get_user_zone(auth.uid()))
  WITH CHECK (delivery_zone_id IS NOT NULL AND delivery_zone_id = private.get_user_zone(auth.uid()));

-- order_items zone-admin read
DROP POLICY IF EXISTS "Zone admin reads zone order items" ON public.order_items;
CREATE POLICY "Zone admin reads zone order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = order_items.order_id
       AND o.delivery_zone_id IS NOT NULL
       AND o.delivery_zone_id = private.get_user_zone(auth.uid())
  ));

-- audit_logs zone-admin read
DROP POLICY IF EXISTS "audit zone admin read" ON public.audit_logs;
CREATE POLICY "audit zone admin read"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    private.is_zone_admin(auth.uid())
    AND (metadata ->> 'zone_id') = (private.get_user_zone(auth.uid()))::text
  );

-- inventory_movements zone-admin read
DROP POLICY IF EXISTS "Zone admin reads zone inventory" ON public.inventory_movements;
CREATE POLICY "Zone admin reads zone inventory"
  ON public.inventory_movements
  FOR SELECT
  TO authenticated
  USING (order_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = inventory_movements.order_id
       AND o.delivery_zone_id = private.get_user_zone(auth.uid())
  ));

-- promotions
DROP POLICY IF EXISTS "Admins manage promotions" ON public.promotions;
CREATE POLICY "Admins manage promotions"
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- discounts
DROP POLICY IF EXISTS "Admins manage discounts" ON public.discounts;
CREATE POLICY "Admins manage discounts"
  ON public.discounts
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- delivery_zones (main admin + zone admin)
DROP POLICY IF EXISTS "Main admin full access zones" ON public.delivery_zones;
CREATE POLICY "Main admin full access zones"
  ON public.delivery_zones
  FOR ALL
  TO authenticated
  USING (private.is_main_admin(auth.uid()))
  WITH CHECK (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "Zone admin reads own zone" ON public.delivery_zones;
CREATE POLICY "Zone admin reads own zone"
  ON public.delivery_zones
  FOR SELECT
  TO authenticated
  USING (id = private.get_user_zone(auth.uid()));

DROP POLICY IF EXISTS "Zone admin updates own zone" ON public.delivery_zones;
CREATE POLICY "Zone admin updates own zone"
  ON public.delivery_zones
  FOR UPDATE
  TO authenticated
  USING (id = private.get_user_zone(auth.uid()))
  WITH CHECK (id = private.get_user_zone(auth.uid()));

-- reservations
DROP POLICY IF EXISTS "Users view own reservations" ON public.reservations;
CREATE POLICY "Users view own reservations"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage reservations" ON public.reservations;
CREATE POLICY "Admins manage reservations"
  ON public.reservations
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- loyalty_programs
DROP POLICY IF EXISTS "Admins manage programs" ON public.loyalty_programs;
CREATE POLICY "Admins manage programs"
  ON public.loyalty_programs
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- loyalty_accounts
DROP POLICY IF EXISTS "Admins manage loyalty" ON public.loyalty_accounts;
CREATE POLICY "Admins manage loyalty"
  ON public.loyalty_accounts
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own loyalty" ON public.loyalty_accounts;
CREATE POLICY "Users view own loyalty"
  ON public.loyalty_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- banners
DROP POLICY IF EXISTS "Admins manage banners" ON public.banners;
CREATE POLICY "Admins manage banners"
  ON public.banners
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- store_hours
DROP POLICY IF EXISTS "Admins manage hours" ON public.store_hours;
CREATE POLICY "Admins manage hours"
  ON public.store_hours
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- featured_items
DROP POLICY IF EXISTS "Admins manage featured" ON public.featured_items;
CREATE POLICY "Admins manage featured"
  ON public.featured_items
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- user_addresses owner select
DROP POLICY IF EXISTS "addresses owner select" ON public.user_addresses;
CREATE POLICY "addresses owner select"
  ON public.user_addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- Revoke EXECUTE from anon/authenticated on the now-unused public helpers
REVOKE EXECUTE ON FUNCTION public.is_main_admin(uuid)              FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_zone(uuid)              FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_zone_admin(uuid)              FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)         FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_zone(uuid, uuid)      FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_stock_availability(jsonb)  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rollback_order_stock(uuid)       FROM anon, authenticated, PUBLIC;
