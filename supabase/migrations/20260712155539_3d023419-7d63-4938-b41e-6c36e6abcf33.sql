-- 1) Extend delivery_zones with fulfilment options
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS collection_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_instructions text,
  ADD COLUMN IF NOT EXISTS collection_prep_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS collection_address text;

-- Anon customers query delivery_zones directly with the publishable key; grant SELECT on the new columns
GRANT SELECT (delivery_enabled, collection_enabled, collection_instructions, collection_prep_minutes, collection_address)
  ON public.delivery_zones TO anon;
GRANT SELECT (delivery_enabled, collection_enabled, collection_instructions, collection_prep_minutes, collection_address)
  ON public.delivery_zones TO authenticated;

-- 2) Extend orders with fulfilment method + snapshots
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS collection_location text,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('delivery','collection'));

-- 3) Refresh the public zones view so the storefront sees fulfilment fields
DROP VIEW IF EXISTS public.delivery_zones_public;
CREATE VIEW public.delivery_zones_public
WITH (security_invoker = true)
AS SELECT
  id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
  hours_text, color, postal_codes, sort_order, image_url,
  delivery_enabled, collection_enabled, collection_instructions,
  collection_prep_minutes, collection_address
FROM public.delivery_zones
WHERE is_active = true;

GRANT SELECT ON public.delivery_zones_public TO anon;
GRANT SELECT ON public.delivery_zones_public TO authenticated;
GRANT ALL ON public.delivery_zones_public TO service_role;