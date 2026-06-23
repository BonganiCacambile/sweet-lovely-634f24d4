DROP POLICY IF EXISTS "Public can view active promotions" ON public.promotions;
REVOKE ALL ON public.promotions FROM anon, authenticated;
GRANT ALL ON public.promotions TO service_role;