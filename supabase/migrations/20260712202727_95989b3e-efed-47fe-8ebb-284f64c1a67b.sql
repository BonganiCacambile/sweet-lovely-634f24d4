
-- 1) Fix ambiguous single-arg has_role usage
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT
  USING ((auth.uid() = id) OR private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "products public read active" ON public.products;
CREATE POLICY "products public read active" ON public.products
  FOR SELECT
  USING (is_active OR private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Drop the ambiguous single-argument helper
DROP FUNCTION IF EXISTS private.has_role(app_role);

-- 3) Move home_* policies off public.has_role onto private.has_role
DROP POLICY IF EXISTS "banners admin read" ON public.home_banners;
CREATE POLICY "banners admin read" ON public.home_banners
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "banners admin write" ON public.home_banners;
CREATE POLICY "banners admin write" ON public.home_banners
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "events admin read" ON public.home_content_events;
CREATE POLICY "events admin read" ON public.home_content_events
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "desserts admin read" ON public.home_desserts;
CREATE POLICY "desserts admin read" ON public.home_desserts
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "desserts admin write" ON public.home_desserts;
CREATE POLICY "desserts admin write" ON public.home_desserts
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "deals admin read" ON public.home_hot_deals;
CREATE POLICY "deals admin read" ON public.home_hot_deals
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "deals admin write" ON public.home_hot_deals;
CREATE POLICY "deals admin write" ON public.home_hot_deals
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "popular admin read" ON public.home_popular_items;
CREATE POLICY "popular admin read" ON public.home_popular_items
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "popular admin write" ON public.home_popular_items;
CREATE POLICY "popular admin write" ON public.home_popular_items
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "visibility admin write" ON public.home_section_visibility;
CREATE POLICY "visibility admin write" ON public.home_section_visibility
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

DROP POLICY IF EXISTS "specials admin read" ON public.home_specials;
CREATE POLICY "specials admin read" ON public.home_specials
  FOR SELECT
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));
DROP POLICY IF EXISTS "specials admin write" ON public.home_specials;
CREATE POLICY "specials admin write" ON public.home_specials
  FOR ALL
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR ((zone_id IS NOT NULL) AND public.can_access_zone(auth.uid(), zone_id)));

-- 4) Revoke direct RPC access to public.has_role from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
