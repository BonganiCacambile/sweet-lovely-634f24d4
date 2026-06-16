
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "email": {"orders": true, "security": true, "promotions": false, "account": true},
    "sms":   {"orders": false, "security": true, "promotions": false, "account": false},
    "push":  {"orders": true, "security": true, "promotions": false, "account": true}
  }'::jsonb;

-- Saved addresses
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  recipient text,
  phone text,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  province text,
  postal_code text,
  country text NOT NULL DEFAULT 'ZA',
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON public.user_addresses(user_id, is_default DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;
GRANT ALL ON public.user_addresses TO service_role;

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addresses owner select" ON public.user_addresses;
CREATE POLICY "addresses owner select" ON public.user_addresses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "addresses owner insert" ON public.user_addresses;
CREATE POLICY "addresses owner insert" ON public.user_addresses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addresses owner update" ON public.user_addresses;
CREATE POLICY "addresses owner update" ON public.user_addresses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addresses owner delete" ON public.user_addresses;
CREATE POLICY "addresses owner delete" ON public.user_addresses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER user_addresses_set_updated_at
  BEFORE UPDATE ON public.user_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One default address per user
CREATE OR REPLACE FUNCTION public.user_addresses_enforce_single_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.user_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER user_addresses_single_default
  AFTER INSERT OR UPDATE OF is_default ON public.user_addresses
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.user_addresses_enforce_single_default();

ALTER TABLE public.user_addresses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_addresses;
