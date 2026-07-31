CREATE OR REPLACE VIEW public.delivery_zones_public WITH (security_invoker='true') AS
 SELECT id,
    slug,
    name,
    description,
    fee_zar,
    min_order_zar,
    eta_minutes,
    hours_text,
    color,
    postal_codes,
    sort_order,
    image_url,
    delivery_enabled,
    collection_enabled,
    collection_instructions,
    collection_prep_minutes,
    collection_address
   FROM public.delivery_zones
  WHERE (is_active = true);

GRANT SELECT ON public.delivery_zones_public TO anon;
GRANT SELECT ON public.delivery_zones_public TO authenticated;
GRANT ALL ON public.delivery_zones_public TO service_role;