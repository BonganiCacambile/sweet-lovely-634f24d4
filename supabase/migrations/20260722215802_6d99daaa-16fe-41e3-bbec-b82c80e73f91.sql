
-- Fix Realtime propagation for home_* content tables.
-- Supabase Realtime evaluates the SELECT policy against the NEW row for UPDATEs.
-- When an admin toggles is_active=false (or moves out of the schedule window),
-- the row failed the anon policy, so the UPDATE event was dropped and the
-- customer home page did not update in real time.
-- The customer queries already filter is_active/starts_at/ends_at client-side,
-- so broadening the anon SELECT to all rows is safe (home content is public).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['home_popular_items','home_hot_deals','home_specials','home_banners','home_desserts']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', replace(t,'home_','')||' public read active', t);
  END LOOP;
END $$;

-- Recreate broadened public read policies (client filters visibility).
DROP POLICY IF EXISTS "popular public read active" ON public.home_popular_items;
CREATE POLICY "popular public read" ON public.home_popular_items
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "hot_deals public read active" ON public.home_hot_deals;
CREATE POLICY "hot_deals public read" ON public.home_hot_deals
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "specials public read active" ON public.home_specials;
CREATE POLICY "specials public read" ON public.home_specials
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "banners public read active" ON public.home_banners;
CREATE POLICY "banners public read" ON public.home_banners
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "desserts public read active" ON public.home_desserts;
CREATE POLICY "desserts public read" ON public.home_desserts
  FOR SELECT TO anon, authenticated USING (true);
