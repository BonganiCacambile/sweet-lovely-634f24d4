--
-- 07_functions.sql — Sweet 'n Lovely Pizza
-- All database functions (public + private schemas), in dependency-safe order.
--
-- Run AFTER the tables/types exist and BEFORE the policies/triggers file.
-- Safe to re-run: every function uses CREATE OR REPLACE.
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET client_min_messages = warning;

-- Disables body validation so cross-schema references resolve regardless of order.
SET check_function_bodies = false;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

--
-- public.has_role
--

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$function$
;

--
-- public.is_main_admin
--

CREATE OR REPLACE FUNCTION public.is_main_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_uid, 'admin'::app_role)
$function$
;

--
-- public.get_user_zone
--

CREATE OR REPLACE FUNCTION public.get_user_zone(_uid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$function$
;

--
-- public.is_zone_admin
--

CREATE OR REPLACE FUNCTION public.is_zone_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$function$
;

--
-- private.has_role
--

CREATE OR REPLACE FUNCTION private.has_role(_uid uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND role = _role
  )
$function$
;

--
-- private.has_permission
--

CREATE OR REPLACE FUNCTION private.has_permission(_user_id uuid, _permission app_permission)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  );
$function$
;

--
-- private.get_user_zone
--

CREATE OR REPLACE FUNCTION private.get_user_zone(_uid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$function$
;

--
-- private.is_main_admin
--

CREATE OR REPLACE FUNCTION private.is_main_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_uid, 'admin'::app_role)
$function$
;

--
-- private.is_zone_admin
--

CREATE OR REPLACE FUNCTION private.is_zone_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$function$
;

--
-- private.can_access_zone
--

CREATE OR REPLACE FUNCTION private.can_access_zone(_uid uuid, _zone_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_main_admin(_uid)
      OR public.get_user_zone(_uid) = _zone_id
$function$
;

--
-- public.set_updated_at
--

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin new.updated_at = now(); return new; end;
$function$
;

--
-- public.handle_new_user
--

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', new.phone, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user')
    on conflict do nothing;
  return new;
end;
$function$
;

--
-- public.user_addresses_enforce_single_default
--

CREATE OR REPLACE FUNCTION public.user_addresses_enforce_single_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.user_addresses
       SET is_default = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END $function$
;

--
-- public.user_roles_validate_zone
--

CREATE OR REPLACE FUNCTION public.user_roles_validate_zone()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role::text = 'zone_admin' THEN
    IF NEW.assigned_zone_id IS NULL THEN
      RAISE EXCEPTION 'zone_admin role requires assigned_zone_id';
    END IF;
  ELSE
    IF NEW.assigned_zone_id IS NOT NULL THEN
      RAISE EXCEPTION 'assigned_zone_id only allowed for zone_admin role';
    END IF;
  END IF;
  RETURN NEW;
END $function$
;

--
-- public.notify_admin_on_new_order
--

CREATE OR REPLACE FUNCTION public.notify_admin_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

--
-- public.notify_customer_on_new_order
--

CREATE OR REPLACE FUNCTION public.notify_customer_on_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

--
-- public.notify_customer_on_order_status_change
--

CREATE OR REPLACE FUNCTION public.notify_customer_on_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

--
-- public.check_stock_availability
--

CREATE OR REPLACE FUNCTION public.check_stock_availability(_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item jsonb;
  v_slug text;
  v_qty int;
  v_stock int;
  v_short jsonb := '[]'::jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    SELECT stock INTO v_stock FROM public.products WHERE slug = v_slug;
    IF v_stock IS NULL OR v_stock < v_qty THEN
      v_short := v_short || jsonb_build_object(
        'slug', v_slug,
        'requested', v_qty,
        'available', COALESCE(v_stock, 0)
      );
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', jsonb_array_length(v_short) = 0, 'shortages', v_short);
END $function$
;

--
-- public.process_order_stock_deduction
--

CREATE OR REPLACE FUNCTION public.process_order_stock_deduction(_order_id uuid, _items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item jsonb;
  v_slug text;
  v_qty int;
  v_before int;
  v_after int;
  v_movements jsonb := '[]'::jsonb;
BEGIN
  -- Phase 1: lock + validate every row up-front so we never partially deduct.
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT stock INTO v_before
      FROM public.products
     WHERE slug = v_slug
     FOR UPDATE;

    IF v_before IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_slug USING ERRCODE = 'P0002';
    END IF;
    IF v_before < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_slug, v_before, v_qty
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Phase 2: apply deductions + audit log.
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.products
       SET stock = stock - v_qty,
           updated_at = now()
     WHERE slug = v_slug
     RETURNING stock INTO v_after;

    INSERT INTO public.inventory_movements
      (product_slug, type, quantity, balance_after, reason, order_id)
    VALUES
      (v_slug, 'sale', -v_qty, v_after,
       'Order ' || _order_id::text || ' deduction', _order_id);

    v_movements := v_movements || jsonb_build_object(
      'slug', v_slug,
      'before', v_after + v_qty,
      'deducted', v_qty,
      'after', v_after,
      'order_id', _order_id
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'movements', v_movements);
END $function$
;

--
-- public.rollback_order_stock
--

CREATE OR REPLACE FUNCTION public.rollback_order_stock(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  mov record;
  v_after int;
  v_movements jsonb := '[]'::jsonb;
BEGIN
  -- Guard: only rollback if a sale was previously recorded and not yet returned.
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
     WHERE order_id = _order_id AND type = 'return'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_rolled_back', true);
  END IF;

  FOR mov IN
    SELECT product_slug, quantity
      FROM public.inventory_movements
     WHERE order_id = _order_id AND type = 'sale'
  LOOP
    UPDATE public.products
       SET stock = stock + ABS(mov.quantity),
           updated_at = now()
     WHERE slug = mov.product_slug
     RETURNING stock INTO v_after;

    INSERT INTO public.inventory_movements
      (product_slug, type, quantity, balance_after, reason, order_id)
    VALUES
      (mov.product_slug, 'return', ABS(mov.quantity), v_after,
       'Order ' || _order_id::text || ' rollback', _order_id);

    v_movements := v_movements || jsonb_build_object(
      'slug', mov.product_slug,
      'restored', ABS(mov.quantity),
      'after', v_after
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'movements', v_movements);
END $function$
;

--
-- public.adjust_product_stock
--

CREATE OR REPLACE FUNCTION public.adjust_product_stock(_slug text, _delta integer, _type text, _reason text DEFAULT NULL::text, _order_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private'
AS $function$
DECLARE
  v_new_balance integer;
  v_email text;
BEGIN
  IF NOT private.has_role('admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF _type NOT IN ('restock','sale','adjustment','return') THEN
    RAISE EXCEPTION 'Invalid movement type: %', _type;
  END IF;

  UPDATE public.products
     SET stock = GREATEST(0, stock + _delta), updated_at = now()
   WHERE slug = _slug
   RETURNING stock INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Product not found: %', _slug;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.inventory_movements
    (product_slug, type, quantity, balance_after, reason, actor_id, actor_email, order_id)
  VALUES
    (_slug, _type, _delta, v_new_balance, _reason, auth.uid(), v_email, _order_id);

  RETURN v_new_balance;
END $function$
;

--
-- public.log_audit_event
--

CREATE OR REPLACE FUNCTION public.log_audit_event(_action text, _entity text DEFAULT NULL::text, _entity_id text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity, entity_id, metadata)
  VALUES (auth.uid(), v_email, _action, _entity, _entity_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$
;

--
-- Privileges
--

-- Public helper functions: callable by the API roles.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_zone_admin(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_zone(uuid) TO anon, authenticated, service_role;

-- RPCs invoked from the app.
GRANT EXECUTE ON FUNCTION public.check_stock_availability(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_order_stock(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated, service_role;

-- Trigger functions must not be callable directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admin_on_new_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_customer_on_new_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_customer_on_order_status_change() FROM PUBLIC;

-- Private schema: used inside RLS policies (security definer).
REVOKE ALL ON FUNCTION private.has_permission(uuid, public.app_permission) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_permission(uuid, public.app_permission) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.can_access_zone(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_access_zone(uuid, uuid) TO anon, authenticated, service_role;

RESET check_function_bodies;

--
-- End of 07_functions.sql
--
