
-- ============================================================
-- Home Page Content Manager
-- ============================================================

-- Helper: updated_at trigger already exists as public.set_updated_at()

-- ----- popular_items -----
CREATE TABLE public.home_popular_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  price text,
  product_slug text REFERENCES public.products(slug) ON DELETE SET NULL,
  category text,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_popular_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_popular_items TO authenticated;
GRANT ALL ON public.home_popular_items TO service_role;
ALTER TABLE public.home_popular_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "popular public read active" ON public.home_popular_items
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );
CREATE POLICY "popular admin read" ON public.home_popular_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE POLICY "popular admin write" ON public.home_popular_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE TRIGGER trg_home_popular_items_updated BEFORE UPDATE ON public.home_popular_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- hot_deals -----
CREATE TABLE public.home_hot_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  product_slug text REFERENCES public.products(slug) ON DELETE SET NULL,
  original_price numeric,
  discounted_price numeric,
  discount_pct integer,
  label text,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_hot_deals TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_hot_deals TO authenticated;
GRANT ALL ON public.home_hot_deals TO service_role;
ALTER TABLE public.home_hot_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals public read active" ON public.home_hot_deals
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );
CREATE POLICY "deals admin read" ON public.home_hot_deals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE POLICY "deals admin write" ON public.home_hot_deals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE TRIGGER trg_home_hot_deals_updated BEFORE UPDATE ON public.home_hot_deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- specials -----
CREATE TABLE public.home_specials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  price text,
  product_slugs text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL DEFAULT 'special',  -- 'special' | 'combo' | 'meal_deal' | 'seasonal' | 'featured'
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_specials TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_specials TO authenticated;
GRANT ALL ON public.home_specials TO service_role;
ALTER TABLE public.home_specials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specials public read active" ON public.home_specials
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );
CREATE POLICY "specials admin read" ON public.home_specials
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE POLICY "specials admin write" ON public.home_specials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE TRIGGER trg_home_specials_updated BEFORE UPDATE ON public.home_specials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- banners -----
CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  cta_label text,
  cta_href text,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_banners TO authenticated;
GRANT ALL ON public.home_banners TO service_role;
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners public read active" ON public.home_banners
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );
CREATE POLICY "banners admin read" ON public.home_banners
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE POLICY "banners admin write" ON public.home_banners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE TRIGGER trg_home_banners_updated BEFORE UPDATE ON public.home_banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- section visibility -----
CREATE TABLE public.home_section_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,  -- 'popular' | 'hot_deals' | 'specials' | 'banners' | 'featured' | 'seasonal'
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section, zone_id)
);
GRANT SELECT ON public.home_section_visibility TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.home_section_visibility TO authenticated;
GRANT ALL ON public.home_section_visibility TO service_role;
ALTER TABLE public.home_section_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visibility public read" ON public.home_section_visibility FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "visibility admin write" ON public.home_section_visibility
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE TRIGGER trg_home_section_visibility_updated BEFORE UPDATE ON public.home_section_visibility FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- events / analytics -----
CREATE TABLE public.home_content_events (
  id bigserial PRIMARY KEY,
  content_type text NOT NULL,  -- 'popular' | 'hot_deal' | 'special' | 'banner'
  content_id uuid NOT NULL,
  event_type text NOT NULL,    -- 'view' | 'click'
  zone_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.home_content_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.home_content_events_id_seq TO anon, authenticated;
GRANT SELECT ON public.home_content_events TO authenticated;
GRANT ALL ON public.home_content_events TO service_role;
ALTER TABLE public.home_content_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events anon insert" ON public.home_content_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "events admin read" ON public.home_content_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (zone_id IS NOT NULL AND public.can_access_zone(auth.uid(), zone_id)));
CREATE INDEX idx_home_events_recent ON public.home_content_events (occurred_at DESC);
CREATE INDEX idx_home_events_target ON public.home_content_events (content_type, content_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_popular_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_hot_deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_specials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_banners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_section_visibility;
