-- 1) Hide reviews.user_id from public (anon) and authenticated readers via column-level privileges.
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, product_slug, author_name, rating, comment, status, created_at, updated_at)
  ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

-- 2) Validate home_content_events inserts against real, active content.
CREATE OR REPLACE FUNCTION private.home_content_ref_exists(_content_type text, _content_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE ok boolean := false;
BEGIN
  CASE _content_type
    WHEN 'popular' THEN SELECT EXISTS(SELECT 1 FROM public.home_popular_items WHERE id = _content_id AND is_active) INTO ok;
    WHEN 'hot_deal' THEN SELECT EXISTS(SELECT 1 FROM public.home_hot_deals WHERE id = _content_id AND is_active) INTO ok;
    WHEN 'special' THEN SELECT EXISTS(SELECT 1 FROM public.home_specials WHERE id = _content_id AND is_active) INTO ok;
    WHEN 'banner' THEN SELECT EXISTS(SELECT 1 FROM public.home_banners WHERE id = _content_id AND is_active) INTO ok;
    WHEN 'dessert' THEN SELECT EXISTS(SELECT 1 FROM public.home_desserts WHERE id = _content_id AND is_active) INTO ok;
    WHEN 'featured' THEN SELECT EXISTS(SELECT 1 FROM public.featured_items WHERE id = _content_id AND is_active) INTO ok;
    ELSE ok := false;
  END CASE;
  RETURN ok;
END $$;

REVOKE ALL ON FUNCTION private.home_content_ref_exists(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.home_content_ref_exists(text, uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "events public insert" ON public.home_content_events;
CREATE POLICY "events public insert" ON public.home_content_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_type = ANY (ARRAY['view','click'])
    AND content_type = ANY (ARRAY['popular','hot_deal','special','banner','featured','dessert'])
    AND private.home_content_ref_exists(content_type, content_id)
    AND (zone_id IS NULL OR EXISTS (SELECT 1 FROM public.delivery_zones z WHERE z.id = zone_id AND z.is_active))
  );