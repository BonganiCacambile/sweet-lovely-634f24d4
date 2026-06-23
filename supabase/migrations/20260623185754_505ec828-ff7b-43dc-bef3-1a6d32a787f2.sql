
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "notifications own read" ON public.notifications;
CREATE POLICY "notifications own read"
  ON public.notifications FOR SELECT
  USING (
    (auth.uid() = user_id)
    OR (user_id IS NULL AND private.has_role(auth.uid(), 'admin'::app_role))
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE OR REPLACE FUNCTION public.notify_admin_on_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, category, read)
  VALUES (
    NULL,
    'New order ' || COALESCE(NEW.order_number, NEW.id::text),
    COALESCE(NEW.customer_name, 'Customer')
      || ' placed an order for R'
      || to_char(COALESCE(NEW.total_zar, 0), 'FM999G999G990D00')
      || CASE WHEN NEW.delivery_zone_name IS NOT NULL
              THEN ' (' || NEW.delivery_zone_name || ')'
              ELSE '' END,
    'order',
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_admin_on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_order();
