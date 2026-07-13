GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_zone(uuid, uuid) TO anon, authenticated;