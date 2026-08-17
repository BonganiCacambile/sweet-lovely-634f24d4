-- 1. notifications: deep-link payload + idempotency key
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 2. devices
CREATE TABLE IF NOT EXISTS public.user_notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('web','android','ios')),
  provider text NOT NULL DEFAULT 'web-local',
  token text NOT NULL,
  device_name text,
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_notification_devices_token_uidx
  ON public.user_notification_devices (token);
CREATE INDEX IF NOT EXISTS user_notification_devices_user_idx
  ON public.user_notification_devices (user_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_devices TO authenticated;
GRANT ALL ON public.user_notification_devices TO service_role;
ALTER TABLE public.user_notification_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own devices select" ON public.user_notification_devices;
CREATE POLICY "own devices select" ON public.user_notification_devices
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "own devices insert" ON public.user_notification_devices;
CREATE POLICY "own devices insert" ON public.user_notification_devices
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "own devices update" ON public.user_notification_devices;
CREATE POLICY "own devices update" ON public.user_notification_devices
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "own devices delete" ON public.user_notification_devices;
CREATE POLICY "own devices delete" ON public.user_notification_devices
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS user_notification_devices_set_updated_at ON public.user_notification_devices;
CREATE TRIGGER user_notification_devices_set_updated_at
  BEFORE UPDATE ON public.user_notification_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. delivery log
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.user_notification_devices(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'web',
  category text NOT NULL DEFAULT 'general',
  order_id uuid,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped','invalid_token')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS notification_deliveries_user_idx ON public.notification_deliveries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx ON public.notification_deliveries (status) WHERE status = 'queued';

GRANT SELECT ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own deliveries select" ON public.notification_deliveries;
CREATE POLICY "own deliveries select" ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- 4. queue pushes on notification insert, honouring preferences
CREATE OR REPLACE FUNCTION public.enqueue_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefs jsonb;
  v_push jsonb;
  v_key text;
  v_allowed boolean;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_key := CASE
    WHEN lower(coalesce(NEW.category,'')) LIKE '%promo%' THEN 'promotions'
    WHEN lower(coalesce(NEW.category,'')) LIKE '%announce%' THEN 'announcements'
    WHEN lower(coalesce(NEW.category,'')) IN ('security') THEN 'security'
    WHEN lower(coalesce(NEW.category,'')) IN ('account') THEN 'account'
    ELSE 'orders'
  END;

  SELECT notification_prefs INTO v_prefs FROM public.profiles WHERE id = NEW.user_id;
  v_push := coalesce(v_prefs -> 'push', '{}'::jsonb);

  -- opt-in categories default OFF, essential categories default ON
  IF v_key IN ('promotions','announcements') THEN
    v_allowed := coalesce((v_push ->> v_key)::boolean, false);
  ELSE
    v_allowed := coalesce((v_push ->> v_key)::boolean, true);
  END IF;

  IF NOT v_allowed THEN
    INSERT INTO public.notification_deliveries
      (notification_id, user_id, platform, category, status, error,
       order_id)
    VALUES (NEW.id, NEW.user_id, 'n/a', v_key, 'skipped', 'user preference disabled',
       nullif(NEW.data ->> 'order_id','')::uuid);
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_deliveries
    (notification_id, user_id, device_id, platform, category, status, order_id)
  SELECT NEW.id, NEW.user_id, d.id, d.platform, v_key, 'queued',
         nullif(NEW.data ->> 'order_id','')::uuid
    FROM public.user_notification_devices d
   WHERE d.user_id = NEW.user_id AND d.is_active;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enqueue_push_for_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_push_for_notification ON public.notifications;
CREATE TRIGGER trg_enqueue_push_for_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_push_for_notification();

-- 5. make order notifications deep-linkable + idempotent
CREATE OR REPLACE FUNCTION public.notify_customer_on_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, category, read, data, dedupe_key)
  VALUES (
    NEW.user_id,
    'Order received',
    'We received your order ' || COALESCE(NEW.order_number, NEW.id::text)
      || '. We''ll let you know as soon as it''s being prepared.',
    'order',
    false,
    jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number,
                       'url', '/account/orders/' || NEW.id::text),
    'order:' || NEW.id::text || ':placed'
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_customer_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_title text;
  v_body  text;
  v_num   text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_num := COALESCE(NEW.order_number, NEW.id::text);

  CASE NEW.status
    WHEN 'pending' THEN
      v_title := 'Order received';
      v_body  := 'Order ' || v_num || ' is awaiting confirmation.';
    WHEN 'preparing' THEN
      v_title := 'Your order is being prepared';
      v_body  := 'Our kitchen is preparing order ' || v_num || ' right now.';
    WHEN 'processing' THEN
      v_title := 'Your order is being processed';
      v_body  := 'Order ' || v_num || ' is being processed.';
    WHEN 'out_for_delivery' THEN
      v_title := 'Out for delivery';
      v_body  := 'Order ' || v_num || ' is on the way to you.';
    WHEN 'completed' THEN
      v_title := 'Ready for pickup';
      v_body  := 'Order ' || v_num || ' is ready for pickup. See you soon!';
    WHEN 'delivered' THEN
      v_title := 'Delivered';
      v_body  := 'Order ' || v_num || ' has been delivered. Enjoy!';
    WHEN 'cancelled' THEN
      v_title := 'Order cancelled';
      v_body  := 'Order ' || v_num || ' has been cancelled.';
    WHEN 'refunded' THEN
      v_title := 'Order refunded';
      v_body  := 'A refund has been issued for order ' || v_num || '.';
    ELSE
      v_title := 'Order updated';
      v_body  := 'Order ' || v_num || ' status changed to ' || NEW.status || '.';
  END CASE;

  INSERT INTO public.notifications (user_id, title, body, category, read, data, dedupe_key)
  VALUES (
    NEW.user_id, v_title, v_body, 'order', false,
    jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number,
                       'status', NEW.status, 'url', '/account/orders/' || NEW.id::text),
    'order:' || NEW.id::text || ':' || NEW.status::text
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;