
CREATE TABLE public.home_desserts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  image_url text,
  price text,
  product_slug text,
  category text,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.home_desserts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_desserts TO authenticated;
GRANT ALL ON public.home_desserts TO service_role;

ALTER TABLE public.home_desserts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "desserts public read active" ON public.home_desserts
  FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now()));

CREATE POLICY "desserts admin read" ON public.home_desserts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
         OR (zone_id IS NOT NULL AND can_access_zone(auth.uid(), zone_id)));

CREATE POLICY "desserts admin write" ON public.home_desserts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
         OR (zone_id IS NOT NULL AND can_access_zone(auth.uid(), zone_id)))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
              OR (zone_id IS NOT NULL AND can_access_zone(auth.uid(), zone_id)));

CREATE TRIGGER home_desserts_set_updated_at
  BEFORE UPDATE ON public.home_desserts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
