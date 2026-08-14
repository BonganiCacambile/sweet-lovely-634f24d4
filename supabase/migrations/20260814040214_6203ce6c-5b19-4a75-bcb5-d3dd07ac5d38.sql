-- 1) Remove sensitive admin tables from the realtime publication
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_logs','integrations','system_settings']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) Re-scope home content policies from role "public" to "authenticated"
DO $$
DECLARE
  p record;
  cmd text;
  using_expr text;
  check_expr text;
BEGIN
  FOR p IN
    SELECT pol.polname,
           c.relname,
           pol.polcmd,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS withcheck,
           pol.polpermissive
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('home_banners','home_desserts','home_hot_deals','home_popular_items',
                        'home_specials','home_section_visibility','home_content_events')
      AND pol.polroles = '{0}'::oid[]
      AND (
        coalesce(pg_get_expr(pol.polqual, pol.polrelid),'') ILIKE '%auth.uid()%'
        OR coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid),'') ILIKE '%auth.uid()%'
      )
  LOOP
    cmd := CASE p.polcmd
             WHEN 'r' THEN 'SELECT'
             WHEN 'a' THEN 'INSERT'
             WHEN 'w' THEN 'UPDATE'
             WHEN 'd' THEN 'DELETE'
             ELSE 'ALL'
           END;
    using_expr := CASE WHEN p.qual IS NOT NULL THEN format(' USING (%s)', p.qual) ELSE '' END;
    check_expr := CASE WHEN p.withcheck IS NOT NULL THEN format(' WITH CHECK (%s)', p.withcheck) ELSE '' END;

    EXECUTE format('DROP POLICY %I ON public.%I', p.polname, p.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS %s FOR %s TO authenticated%s%s',
      p.polname, p.relname,
      CASE WHEN p.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd, using_expr, check_expr
    );
  END LOOP;
END $$;