
CREATE TABLE public.admin_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','active','idle','away','offline')),
  assigned_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  user_agent text,
  login_at timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_presence TO authenticated;
GRANT ALL ON public.admin_presence TO service_role;

ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Main admin can view all presence"
  ON public.admin_presence FOR SELECT
  TO authenticated
  USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Users can view own presence"
  ON public.admin_presence FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own presence"
  ON public.admin_presence FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own presence"
  ON public.admin_presence FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_admin_presence_updated_at
  BEFORE UPDATE ON public.admin_presence
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_presence;
ALTER TABLE public.admin_presence REPLICA IDENTITY FULL;
