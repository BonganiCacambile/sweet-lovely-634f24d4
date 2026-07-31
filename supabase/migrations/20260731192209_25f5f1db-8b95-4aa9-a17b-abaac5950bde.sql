CREATE OR REPLACE FUNCTION private.is_main_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION private.can_access_zone(_uid uuid, _zone_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT private.is_main_admin(_uid) OR private.get_user_zone(_uid) = _zone_id
$$;

GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_main_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_zone_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_user_zone(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_access_zone(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_main_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_zone_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_zone(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_zone(uuid, uuid) TO anon, authenticated, service_role;

DO $do$
DECLARE
  p record;
  v_qual text;
  v_check text;
  v_roles text;
  v_fn text;
  v_sql text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'public\.(has_role|is_main_admin|is_zone_admin|get_user_zone)\s*\('
  LOOP
    v_qual := coalesce(p.qual, '');
    v_check := coalesce(p.with_check, '');
    FOREACH v_fn IN ARRAY ARRAY['has_role','is_main_admin','is_zone_admin','get_user_zone'] LOOP
      v_qual := replace(v_qual, 'public.' || v_fn || '(', 'private.' || v_fn || '(');
      v_check := replace(v_check, 'public.' || v_fn || '(', 'private.' || v_fn || '(');
    END LOOP;
    IF p.qual IS NULL THEN v_qual := NULL; END IF;
    IF p.with_check IS NULL THEN v_check := NULL; END IF;

    v_roles := array_to_string(p.roles, ', ');

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);

    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, v_roles);
    IF v_qual IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', v_qual); END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', v_check); END IF;
    EXECUTE v_sql;
  END LOOP;
END
$do$;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_main_admin(uuid);
DROP FUNCTION IF EXISTS public.is_zone_admin(uuid);
DROP FUNCTION IF EXISTS public.get_user_zone(uuid);