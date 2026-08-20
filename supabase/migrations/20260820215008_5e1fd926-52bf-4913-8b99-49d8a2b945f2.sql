
-- 1. Customer's currently selected delivery zone (server-side source of truth)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- 2. Support request structure
CREATE SEQUENCE IF NOT EXISTS public.support_request_ref_seq START 10001;
GRANT USAGE, SELECT ON SEQUENCE public.support_request_ref_seq TO authenticated, service_role;

ALTER TABLE public.support_requests
  ADD COLUMN IF NOT EXISTS delivery_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_email text,
  ADD COLUMN IF NOT EXISTS resolution text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

UPDATE public.support_requests
   SET reference = 'SR-' || lpad(nextval('public.support_request_ref_seq')::text, 5, '0')
 WHERE reference IS NULL;

ALTER TABLE public.support_requests
  ALTER COLUMN reference SET DEFAULT 'SR-' || lpad(nextval('public.support_request_ref_seq')::text, 5, '0');
ALTER TABLE public.support_requests ALTER COLUMN reference SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS support_requests_reference_key ON public.support_requests(reference);
CREATE INDEX IF NOT EXISTS support_requests_zone_idx ON public.support_requests(delivery_zone_id);
CREATE INDEX IF NOT EXISTS support_requests_user_idx ON public.support_requests(user_id);

ALTER TABLE public.support_request_replies
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

-- 3. Change history
CREATE TABLE IF NOT EXISTS public.support_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  field text NOT NULL,
  from_value text,
  to_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_request_events TO authenticated;
GRANT ALL ON public.support_request_events TO service_role;
ALTER TABLE public.support_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view support events" ON public.support_request_events;
CREATE POLICY "Admins view support events" ON public.support_request_events
  FOR SELECT TO authenticated
  USING (
    private.is_main_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.support_requests r
       WHERE r.id = request_id AND private.can_access_zone(auth.uid(), r.delivery_zone_id)
    )
  );

DROP POLICY IF EXISTS "Admins insert support events" ON public.support_request_events;
CREATE POLICY "Admins insert support events" ON public.support_request_events
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_main_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.support_requests r
       WHERE r.id = request_id AND private.can_access_zone(auth.uid(), r.delivery_zone_id)
    )
  );

-- 4. RLS on support_requests
GRANT SELECT, INSERT, UPDATE ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;

DROP POLICY IF EXISTS "Admins can view support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Admins can update support requests" ON public.support_requests;
DROP POLICY IF EXISTS "Support requests readable by owner or scoped admin" ON public.support_requests;
CREATE POLICY "Support requests readable by owner or scoped admin" ON public.support_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR private.is_main_admin(auth.uid())
    OR private.can_access_zone(auth.uid(), delivery_zone_id)
  );

DROP POLICY IF EXISTS "Customers create own support requests" ON public.support_requests;
CREATE POLICY "Customers create own support requests" ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Scoped admins update support requests" ON public.support_requests;
CREATE POLICY "Scoped admins update support requests" ON public.support_requests
  FOR UPDATE TO authenticated
  USING (private.is_main_admin(auth.uid()) OR private.can_access_zone(auth.uid(), delivery_zone_id))
  WITH CHECK (private.is_main_admin(auth.uid()) OR private.can_access_zone(auth.uid(), delivery_zone_id));

-- Zone integrity: only a main admin may ever move a request between zones.
CREATE OR REPLACE FUNCTION public.support_requests_protect_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_zone_id IS DISTINCT FROM OLD.delivery_zone_id
     AND auth.uid() IS NOT NULL
     AND NOT private.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: the delivery zone of a support request cannot be changed';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND auth.uid() IS NOT NULL
     AND NOT private.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: the owner of a support request cannot be changed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS support_requests_protect_zone_trg ON public.support_requests;
CREATE TRIGGER support_requests_protect_zone_trg
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.support_requests_protect_zone();

-- 5. RLS on replies (internal notes hidden from customers)
GRANT SELECT, INSERT ON public.support_request_replies TO authenticated;
GRANT ALL ON public.support_request_replies TO service_role;

DROP POLICY IF EXISTS "Admins can view support replies" ON public.support_request_replies;
DROP POLICY IF EXISTS "Admins can add support replies" ON public.support_request_replies;
DROP POLICY IF EXISTS "Support replies readable by owner or scoped admin" ON public.support_request_replies;
CREATE POLICY "Support replies readable by owner or scoped admin" ON public.support_request_replies
  FOR SELECT TO authenticated
  USING (
    private.is_main_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.support_requests r
       WHERE r.id = request_id
         AND (
           private.can_access_zone(auth.uid(), r.delivery_zone_id)
           OR (r.user_id = auth.uid() AND is_internal = false)
         )
    )
  );

DROP POLICY IF EXISTS "Scoped admins add support replies" ON public.support_request_replies;
CREATE POLICY "Scoped admins add support replies" ON public.support_request_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_main_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.support_requests r
       WHERE r.id = request_id AND private.can_access_zone(auth.uid(), r.delivery_zone_id)
    )
  );

-- 6. Notify main admins + the matching zone's employees on new requests
CREATE OR REPLACE FUNCTION public.notify_admins_on_support_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
BEGIN
  SELECT name INTO v_zone FROM public.delivery_zones WHERE id = NEW.delivery_zone_id;

  INSERT INTO public.notifications (user_id, title, body, category, read, data, dedupe_key)
  SELECT DISTINCT ur.user_id,
         'New support request' || CASE WHEN v_zone IS NOT NULL THEN ' — ' || v_zone ELSE '' END,
         COALESCE(NULLIF(NEW.subject, ''), 'Support request') || ': ' || left(NEW.message, 180),
         'account',
         false,
         jsonb_build_object(
           'support_request_id', NEW.id,
           'reference', NEW.reference,
           'zone_id', NEW.delivery_zone_id,
           'zone_name', v_zone,
           'priority', NEW.priority,
           'url', '/admin/support-requests'
         ),
         'support_request:' || NEW.id::text || ':' || ur.user_id::text
    FROM public.user_roles ur
   WHERE ur.role = 'admin'
      OR (ur.assigned_zone_id IS NOT NULL AND ur.assigned_zone_id = NEW.delivery_zone_id)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_admins_on_support_request_trg ON public.support_requests;
CREATE TRIGGER notify_admins_on_support_request_trg
  AFTER INSERT ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_support_request();

-- 7. Realtime (RLS-scoped)
ALTER TABLE public.support_requests REPLICA IDENTITY FULL;
ALTER TABLE public.support_request_replies REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_request_replies;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
