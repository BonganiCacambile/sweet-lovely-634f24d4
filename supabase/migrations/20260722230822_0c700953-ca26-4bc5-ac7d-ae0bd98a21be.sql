
-- Replace unconditional public SELECT policies with scoped ones on home_* tables

DROP POLICY IF EXISTS "banners public read" ON public.home_banners;
CREATE POLICY "banners public read active" ON public.home_banners
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

DROP POLICY IF EXISTS "desserts public read" ON public.home_desserts;
CREATE POLICY "desserts public read active" ON public.home_desserts
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

DROP POLICY IF EXISTS "hot_deals public read" ON public.home_hot_deals;
-- "deals public read active" already exists and enforces the same window.

DROP POLICY IF EXISTS "popular public read" ON public.home_popular_items;
CREATE POLICY "popular public read active" ON public.home_popular_items
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

DROP POLICY IF EXISTS "specials public read" ON public.home_specials;
CREATE POLICY "specials public read active" ON public.home_specials
  FOR SELECT TO anon, authenticated
  USING (is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now()));

-- home_section_visibility has no active/date columns; restrict public reads to global (zone_id IS NULL) rows.
DROP POLICY IF EXISTS "visibility public read" ON public.home_section_visibility;
CREATE POLICY "visibility public read global" ON public.home_section_visibility
  FOR SELECT TO anon, authenticated
  USING (zone_id IS NULL);
