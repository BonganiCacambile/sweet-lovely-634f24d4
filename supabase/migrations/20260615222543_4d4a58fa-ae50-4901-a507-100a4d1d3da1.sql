DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','content_pages','system_settings','reviews','order_items','audit_logs','integrations']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- Public read access for catalog tables so unauthenticated visitors can see live menu
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='Public can view active products') THEN
    CREATE POLICY "Public can view active products" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='categories' AND policyname='Public can view categories') THEN
    CREATE POLICY "Public can view categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.categories TO anon;