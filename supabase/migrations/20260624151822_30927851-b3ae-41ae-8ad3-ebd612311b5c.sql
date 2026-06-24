
-- Customer-facing order notifications: insert into public.notifications whenever
-- a new order is placed or an existing order's status changes.

CREATE OR REPLACE FUNCTION public.notify_customer_on_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, title, body, category, read)
  VALUES (
    NEW.user_id,
    'Order received',
    'We received your order ' || COALESCE(NEW.order_number, NEW.id::text)
      || '. We''ll let you know as soon as it''s being prepared.',
    'order',
    false
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_customer_on_new_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_customer_on_new_order ON public.orders;
CREATE TRIGGER trg_notify_customer_on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_on_new_order();


CREATE OR REPLACE FUNCTION public.notify_customer_on_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  INSERT INTO public.notifications (user_id, title, body, category, read)
  VALUES (NEW.user_id, v_title, v_body, 'order', false);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_customer_on_order_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_customer_on_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_customer_on_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_on_order_status_change();

-- Ensure realtime payloads include enough row data for client-side filtering.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
