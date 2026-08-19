-- =========================================================
-- 1. Employee security state
-- =========================================================
CREATE TABLE IF NOT EXISTS public.employee_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_disabled boolean NOT NULL DEFAULT false,
  disabled_at timestamptz,
  disabled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  disabled_reason text,
  mfa_required boolean NOT NULL DEFAULT true,
  mfa_exempt boolean NOT NULL DEFAULT false,
  mfa_exempt_reason text,
  sessions_revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.employee_security TO authenticated;
GRANT ALL ON public.employee_security TO service_role;
ALTER TABLE public.employee_security ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS employee_security_set_updated_at ON public.employee_security;
CREATE TRIGGER employee_security_set_updated_at
  BEFORE UPDATE ON public.employee_security
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2. Per-zone working hours
-- =========================================================
CREATE TABLE IF NOT EXISTS public.zone_access_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at time NOT NULL DEFAULT '07:00',
  closes_at time NOT NULL DEFAULT '22:00',
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zone_id, day_of_week)
);

GRANT SELECT ON public.zone_access_hours TO authenticated;
GRANT ALL ON public.zone_access_hours TO service_role;
ALTER TABLE public.zone_access_hours ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS zone_access_hours_set_updated_at ON public.zone_access_hours;
CREATE TRIGGER zone_access_hours_set_updated_at
  BEFORE UPDATE ON public.zone_access_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3. Security alerts
-- =========================================================
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  type text NOT NULL,
  actor_id uuid,
  actor_email text,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_alerts_created_idx ON public.security_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS security_alerts_actor_idx ON public.security_alerts (actor_id, created_at DESC);

GRANT SELECT, UPDATE ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 4. Data export log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.data_export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  entity text NOT NULL,
  format text NOT NULL DEFAULT 'csv',
  row_count integer NOT NULL DEFAULT 0,
  fields text[] NOT NULL DEFAULT '{}',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_export_logs_created_idx ON public.data_export_logs (created_at DESC);

GRANT SELECT ON public.data_export_logs TO authenticated;
GRANT ALL ON public.data_export_logs TO service_role;
ALTER TABLE public.data_export_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 5. Account state helpers (disabled + revoked sessions)
-- =========================================================
CREATE OR REPLACE FUNCTION private.account_enabled(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT COALESCE((SELECT is_disabled FROM public.employee_security WHERE user_id = _uid), false)
$$;

CREATE OR REPLACE FUNCTION private.session_current(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT sessions_revoked_at FROM public.employee_security WHERE user_id = _uid),
    '-infinity'::timestamptz
  ) <= COALESCE(
    to_timestamp(NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'iat','')::numeric),
    now()
  )
$$;

CREATE OR REPLACE FUNCTION private.access_allowed(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.account_enabled(_uid) AND private.session_current(_uid)
$$;

REVOKE ALL ON FUNCTION private.account_enabled(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.session_current(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.access_allowed(uuid) FROM PUBLIC, anon, authenticated;

-- Role checks now fail closed for disabled accounts and revoked sessions.
CREATE OR REPLACE FUNCTION private.has_role(_uid uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.access_allowed(_uid) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_main_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.access_allowed(_uid) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'admin'::app_role
  )
$$;

CREATE OR REPLACE FUNCTION private.is_zone_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT private.access_allowed(_uid) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION private.get_user_zone(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
     AND private.access_allowed(_uid)
   LIMIT 1
$$;

-- =========================================================
-- 6. Policies for the new tables
-- =========================================================
DROP POLICY IF EXISTS "employee_security main admin all" ON public.employee_security;
CREATE POLICY "employee_security main admin all" ON public.employee_security
  FOR ALL TO authenticated
  USING (private.is_main_admin(auth.uid()))
  WITH CHECK (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "employee_security read own" ON public.employee_security;
CREATE POLICY "employee_security read own" ON public.employee_security
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "zone_access_hours main admin all" ON public.zone_access_hours;
CREATE POLICY "zone_access_hours main admin all" ON public.zone_access_hours
  FOR ALL TO authenticated
  USING (private.is_main_admin(auth.uid()))
  WITH CHECK (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "zone_access_hours zone admin read own zone" ON public.zone_access_hours;
CREATE POLICY "zone_access_hours zone admin read own zone" ON public.zone_access_hours
  FOR SELECT TO authenticated
  USING (zone_id = private.get_user_zone(auth.uid()));

DROP POLICY IF EXISTS "security_alerts main admin read" ON public.security_alerts;
CREATE POLICY "security_alerts main admin read" ON public.security_alerts
  FOR SELECT TO authenticated
  USING (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "security_alerts main admin update" ON public.security_alerts;
CREATE POLICY "security_alerts main admin update" ON public.security_alerts
  FOR UPDATE TO authenticated
  USING (private.is_main_admin(auth.uid()))
  WITH CHECK (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "data_export_logs main admin read" ON public.data_export_logs;
CREATE POLICY "data_export_logs main admin read" ON public.data_export_logs
  FOR SELECT TO authenticated
  USING (private.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "data_export_logs read own" ON public.data_export_logs;
CREATE POLICY "data_export_logs read own" ON public.data_export_logs
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid());

-- =========================================================
-- 7. Privilege-escalation protection on user_roles
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_roles_block_self_modify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_email text;
BEGIN
  IF v_uid IS NOT NULL AND v_target = v_uid THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.security_alerts (severity, type, actor_id, actor_email, message, metadata)
    VALUES ('critical', 'privilege_escalation_attempt', v_uid, v_email,
            'Blocked attempt to modify own role assignment',
            jsonb_build_object('operation', TG_OP,
                               'role', COALESCE(NEW.role::text, OLD.role::text),
                               'zone_id', COALESCE(NEW.assigned_zone_id, OLD.assigned_zone_id)));
    INSERT INTO public.audit_logs (actor_id, actor_email, action, entity, entity_id, metadata)
    VALUES (v_uid, v_email, 'security.privilege_escalation_blocked', 'user_roles', v_target::text,
            jsonb_build_object('operation', TG_OP));
    RAISE EXCEPTION 'Forbidden: you cannot modify your own role or zone assignment';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS user_roles_block_self_modify_trg ON public.user_roles;
CREATE TRIGGER user_roles_block_self_modify_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.user_roles_block_self_modify();

-- =========================================================
-- 8. Default security settings
-- =========================================================
INSERT INTO public.system_settings (group_key, key, value, description) VALUES
  ('security', 'idle_timeout_minutes', '15'::jsonb, 'Employee admin idle timeout in minutes'),
  ('security', 'max_session_hours', '8'::jsonb, 'Maximum employee admin session duration in hours'),
  ('security', 'reauth_window_minutes', '10'::jsonb, 'Recent-authentication window for sensitive actions'),
  ('security', 'enforce_mfa', 'true'::jsonb, 'Require MFA for admin and zone admin accounts'),
  ('security', 'enforce_working_hours', 'false'::jsonb, 'Restrict zone admin access to configured zone hours'),
  ('security', 'alert_customer_reads_per_hour', '200'::jsonb, 'Customer records read per hour before alerting'),
  ('security', 'alert_denied_attempts_per_hour', '10'::jsonb, 'Authorization failures per hour before alerting'),
  ('security', 'export_max_rows_zone_admin', '500'::jsonb, 'Maximum rows a zone admin may export at once')
ON CONFLICT (group_key, key) DO NOTHING;