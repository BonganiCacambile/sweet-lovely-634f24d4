
-- 1) products: enable-size-selection toggle
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_selection_enabled boolean NOT NULL DEFAULT false;

-- 2) product_sizes table
CREATE TABLE IF NOT EXISTS public.product_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_slug text NOT NULL REFERENCES public.products(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  name text NOT NULL,
  description text,
  portion text,
  price_zar numeric NOT NULL DEFAULT 0 CHECK (price_zar >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_sizes_product_slug_idx
  ON public.product_sizes(product_slug, sort_order);

-- 3) Grants
GRANT SELECT ON public.product_sizes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sizes TO authenticated;
GRANT ALL ON public.product_sizes TO service_role;

-- 4) RLS
ALTER TABLE public.product_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view available sizes"
  ON public.product_sizes
  FOR SELECT
  TO anon, authenticated
  USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.slug = product_sizes.product_slug AND p.is_active = true
    )
  );

CREATE POLICY "Admins can view all sizes"
  ON public.product_sizes
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert sizes"
  ON public.product_sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sizes"
  ON public.product_sizes
  FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sizes"
  ON public.product_sizes
  FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 5) updated_at trigger (reuse existing set_updated_at)
DROP TRIGGER IF EXISTS product_sizes_set_updated_at ON public.product_sizes;
CREATE TRIGGER product_sizes_set_updated_at
  BEFORE UPDATE ON public.product_sizes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Realtime
ALTER TABLE public.product_sizes REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'product_sizes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.product_sizes';
  END IF;
END $$;
