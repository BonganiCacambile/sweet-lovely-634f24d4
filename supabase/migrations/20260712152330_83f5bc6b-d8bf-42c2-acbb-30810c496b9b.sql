
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_medium_zar numeric,
  ADD COLUMN IF NOT EXISTS price_large_zar numeric;

UPDATE public.products
   SET price_medium_zar = COALESCE(price_medium_zar, 80),
       price_large_zar  = COALESCE(price_large_zar, 150)
 WHERE category_slug = 'pizza';
