
-- 1) SUPA_rls_policy_always_true: drop overly-permissive anon insert on home_content_events
DROP POLICY IF EXISTS "events anon insert" ON public.home_content_events;

-- 2) delivery_zones_contact_info_public: revoke sensitive columns from anon + authenticated
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM anon;
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM authenticated;

-- 3 & 4) Normalize has_role calls to the explicit (auth.uid(), role) signature
-- audit_logs
DROP POLICY IF EXISTS "audit admin insert" ON public.audit_logs;
CREATE POLICY "audit admin insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "audit admin read" ON public.audit_logs;
CREATE POLICY "audit admin read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- categories
DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- content_pages
DROP POLICY IF EXISTS "content admin write" ON public.content_pages;
CREATE POLICY "content admin write" ON public.content_pages
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "content public read published" ON public.content_pages;
CREATE POLICY "content public read published" ON public.content_pages
  FOR SELECT
  USING ((status = 'published'::text) OR private.has_role(auth.uid(), 'admin'::app_role));

-- integrations
DROP POLICY IF EXISTS "integrations admin all" ON public.integrations;
CREATE POLICY "integrations admin all" ON public.integrations
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- inventory_movements
DROP POLICY IF EXISTS "inventory_movements admin insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin insert" ON public.inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "inventory_movements admin read" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin read" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- notifications
DROP POLICY IF EXISTS "notifications admin delete" ON public.notifications;
CREATE POLICY "notifications admin delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications admin insert" ON public.notifications;
CREATE POLICY "notifications admin insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "notifications own read" ON public.notifications;
CREATE POLICY "notifications own read" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- order_items
DROP POLICY IF EXISTS "order_items admin delete" ON public.order_items;
CREATE POLICY "order_items admin delete" ON public.order_items
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "order_items admin update" ON public.order_items;
CREATE POLICY "order_items admin update" ON public.order_items
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "order_items read via order" ON public.order_items;
CREATE POLICY "order_items read via order" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role))
  ));

-- orders
DROP POLICY IF EXISTS "orders admin delete" ON public.orders;
CREATE POLICY "orders admin delete" ON public.orders
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders admin update" ON public.orders;
CREATE POLICY "orders admin update" ON public.orders
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "orders user read own" ON public.orders;
CREATE POLICY "orders user read own" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- products
DROP POLICY IF EXISTS "products admin write" ON public.products;
CREATE POLICY "products admin write" ON public.products
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- reviews
DROP POLICY IF EXISTS "reviews admin delete" ON public.reviews;
CREATE POLICY "reviews admin delete" ON public.reviews
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "reviews admin manage" ON public.reviews;
CREATE POLICY "reviews admin manage" ON public.reviews
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- system_settings ("settings admin all")
DROP POLICY IF EXISTS "settings admin all" ON public.system_settings;
CREATE POLICY "settings admin all" ON public.system_settings
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- role_permissions write
DROP POLICY IF EXISTS "role_permissions admin write" ON public.role_permissions;
CREATE POLICY "role_permissions admin write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- 5) promotions_full_details_public: hide internal metrics from public/authenticated reads
REVOKE SELECT (value, usage_limit, times_used) ON public.promotions FROM anon;
REVOKE SELECT (value, usage_limit, times_used) ON public.promotions FROM authenticated;
