-- Restrict public exposure of inventory columns on products.
REVOKE SELECT ON public.products FROM anon, authenticated;

GRANT SELECT (slug, title, description, price_zar, category_slug, image, allergens, nutrition, portion, is_active, sort_order, created_at, updated_at)
  ON public.products TO anon, authenticated;

-- Admins keep full access (stock + low_stock_threshold) via service_role and authenticated admin role.
GRANT SELECT (stock, low_stock_threshold) ON public.products TO service_role;
GRANT ALL ON public.products TO service_role;