
CREATE OR REPLACE VIEW public.delivery_zones_public
WITH (security_invoker = off) AS
SELECT id, slug, name, description, fee_zar, min_order_zar, eta_minutes,
       hours_text, color, postal_codes, sort_order, image_url,
       contact_phone, contact_email
  FROM public.delivery_zones
 WHERE is_active = true;

GRANT SELECT ON public.delivery_zones_public TO anon, authenticated;
