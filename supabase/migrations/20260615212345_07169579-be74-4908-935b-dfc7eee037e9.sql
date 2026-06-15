
CREATE TABLE public.content_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  seo_title text,
  seo_description text,
  publish_at timestamptz,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_pages_status_chk CHECK (status IN ('draft','published','archived'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_pages TO authenticated;
GRANT ALL ON public.content_pages TO service_role;
GRANT SELECT ON public.content_pages TO anon;
ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content public read published" ON public.content_pages FOR SELECT
  USING (status = 'published' OR private.has_role('admin'::app_role));
CREATE POLICY "content admin write" ON public.content_pages FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role)) WITH CHECK (private.has_role('admin'::app_role));
CREATE TRIGGER trg_content_pages_updated BEFORE UPDATE ON public.content_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_status_chk CHECK (status IN ('connected','disconnected','error','pending'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations admin all" ON public.integrations FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role)) WITH CHECK (private.has_role('admin'::app_role));
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.system_settings (
  group_key text NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_key, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings admin all" ON public.system_settings FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role)) WITH CHECK (private.has_role('admin'::app_role));
CREATE TRIGGER trg_system_settings_updated BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.integrations (provider, display_name, category, status) VALUES
  ('paystack','Paystack','payments','disconnected'),
  ('resend','Resend','email','disconnected'),
  ('twilio','Twilio','sms','disconnected'),
  ('google_analytics','Google Analytics','analytics','disconnected'),
  ('slack','Slack','notifications','disconnected')
ON CONFLICT (provider) DO NOTHING;

INSERT INTO public.system_settings (group_key, key, value, description) VALUES
  ('store','currency','"ZAR"','Store currency code'),
  ('store','low_stock_threshold','5','Default low-stock threshold for new products'),
  ('store','order_prefix','"SL"','Order number prefix'),
  ('email','from_address','"orders@example.com"','Default from-address for transactional email'),
  ('email','from_name','"Saucy Lemon"','Default sender name'),
  ('security','password_min_length','8','Minimum password length'),
  ('security','session_idle_minutes','60','Idle minutes before re-auth required'),
  ('branding','site_name','"Saucy Lemon"','Site display name'),
  ('branding','support_email','"help@example.com"','Public support email')
ON CONFLICT DO NOTHING;
