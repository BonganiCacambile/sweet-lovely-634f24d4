-- Authenticated role needs full column access; row-level security still restricts non-admins to active products only (which is fine — stock visibility for signed-in users is acceptable, the concern is anonymous public exposure).
GRANT SELECT ON public.products TO authenticated;

-- Anonymous visitors keep restricted column-level SELECT (no stock / low_stock_threshold).
-- (Already set in previous migration.)