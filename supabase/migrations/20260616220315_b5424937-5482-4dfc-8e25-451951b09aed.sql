
ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS hours_text text,
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_zone_name text;

CREATE INDEX IF NOT EXISTS orders_delivery_zone_id_idx ON public.orders(delivery_zone_id);

INSERT INTO public.delivery_zones (slug, name, postal_codes, fee_zar, min_order_zar, eta_minutes, is_active, sort_order, description, contact_phone, contact_email, hours_text, color)
SELECT * FROM (VALUES
  ('sandton',  'Sandton',  ARRAY['2196','2031','2146']::text[], 45, 150, 35, true, 1, 'Sandton CBD, Sandhurst, Morningside', '+27 11 555 0101', 'sandton@sweetnlovely.co.za',  'Mon–Sun 10:00–22:00', '#ff003c'),
  ('rosebank', 'Rosebank', ARRAY['2196','2132','2193']::text[], 40, 120, 30, true, 2, 'Rosebank, Parkwood, Hyde Park',       '+27 11 555 0102', 'rosebank@sweetnlovely.co.za', 'Mon–Sun 10:00–22:00', '#f59e0b'),
  ('fourways', 'Fourways', ARRAY['2055','2191','2068']::text[], 55, 180, 45, true, 3, 'Fourways, Lonehill, Bryanston',       '+27 11 555 0103', 'fourways@sweetnlovely.co.za', 'Mon–Sun 11:00–22:00', '#10b981'),
  ('midrand',  'Midrand',  ARRAY['1685','1682','1684']::text[], 60, 200, 50, true, 4, 'Midrand, Halfway House, Carlswald',   '+27 11 555 0104', 'midrand@sweetnlovely.co.za',  'Mon–Sun 11:00–21:30', '#6366f1')
) AS v(slug, name, postal_codes, fee_zar, min_order_zar, eta_minutes, is_active, sort_order, description, contact_phone, contact_email, hours_text, color)
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones);
