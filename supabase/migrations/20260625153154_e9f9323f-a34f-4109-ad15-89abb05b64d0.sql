
DROP VIEW IF EXISTS public.delivery_zones_public;

ALTER VIEW IF EXISTS public.delivery_zones_public SET (security_invoker = on);

-- Recreate as a security_invoker view so it respects RLS / column grants of the caller.
CREATE VIEW public.delivery_zones_public
WITH (security_invoker = on) AS
SELECT id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
       hours_text, color, postal_codes, sort_order, image_url,
       contact_phone, contact_email
  FROM public.delivery_zones
 WHERE is_active = true;

GRANT SELECT
  (id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
   hours_text, color, postal_codes, sort_order, image_url,
   contact_phone, contact_email, is_active)
  ON public.delivery_zones TO anon, authenticated;

GRANT SELECT ON public.delivery_zones_public TO anon, authenticated;
