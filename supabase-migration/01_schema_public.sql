--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_permission; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_permission AS ENUM (
    'orders.read',
    'orders.write',
    'orders.refund',
    'products.read',
    'products.write',
    'categories.read',
    'categories.write',
    'inventory.read',
    'inventory.write',
    'reviews.read',
    'reviews.moderate',
    'users.read',
    'users.write',
    'roles.read',
    'roles.write',
    'audit.read',
    'content.read',
    'content.write',
    'notifications.read',
    'notifications.write',
    'reports.read',
    'analytics.read',
    'integrations.read',
    'integrations.write',
    'security.read',
    'security.write',
    'settings.read',
    'settings.write'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user',
    'zone_admin'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'preparing',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'processing',
    'completed',
    'refunded'
);


--
-- Name: review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: adjust_product_stock(text, integer, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adjust_product_stock(_slug text, _delta integer, _type text, _reason text DEFAULT NULL::text, _order_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'private'
    AS $$
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
END $$;


--
-- Name: check_stock_availability(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_stock_availability(_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
END $$;


--
-- Name: get_user_zone(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_zone(_uid uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;


--
-- Name: is_main_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_main_admin(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
$$;


--
-- Name: is_zone_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_zone_admin(_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$$;


--
-- Name: log_audit_event(text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_audit_event(_action text, _entity text DEFAULT NULL::text, _entity_id text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
DECLARE
  v_id uuid;
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity, entity_id, metadata)
  VALUES (auth.uid(), v_email, _action, _entity, _entity_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;


--
-- Name: notify_admin_on_new_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_admin_on_new_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: notify_customer_on_new_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_customer_on_new_order() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: notify_customer_on_order_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_customer_on_order_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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

  INSERT INTO public.notifications (user_id, title, body, category, read)
  VALUES (NEW.user_id, v_title, v_body, 'order', false);

  RETURN NEW;
END;
$$;


--
-- Name: process_order_stock_deduction(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_order_stock_deduction(_order_id uuid, _items jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
END $$;


--
-- Name: rollback_order_stock(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rollback_order_stock(_order_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
END $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin new.updated_at = now(); return new; end;
$$;


--
-- Name: user_addresses_enforce_single_default(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_addresses_enforce_single_default() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: user_roles_validate_zone(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_roles_validate_zone() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_presence (
    user_id uuid NOT NULL,
    status text DEFAULT 'offline'::text NOT NULL,
    assigned_zone_id uuid,
    user_agent text,
    login_at timestamp with time zone,
    last_active_at timestamp with time zone DEFAULT now() NOT NULL,
    last_heartbeat_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_presence_status_check CHECK ((status = ANY (ARRAY['online'::text, 'active'::text, 'idle'::text, 'away'::text, 'offline'::text])))
);

ALTER TABLE ONLY public.admin_presence REPLICA IDENTITY FULL;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_email text,
    action text NOT NULL,
    entity text,
    entity_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.audit_logs REPLICA IDENTITY FULL;


--
-- Name: banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    image text,
    cta_label text,
    cta_href text,
    placement text DEFAULT 'home'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT banners_placement_check CHECK ((placement = ANY (ARRAY['home'::text, 'menu'::text, 'checkout'::text, 'global'::text])))
);

ALTER TABLE ONLY public.banners REPLICA IDENTITY FULL;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    slug text NOT NULL,
    label text NOT NULL,
    image text,
    intro text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.categories REPLICA IDENTITY FULL;


--
-- Name: content_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    seo_title text,
    seo_description text,
    publish_at timestamp with time zone,
    author_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_pages_status_chk CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);

ALTER TABLE ONLY public.content_pages REPLICA IDENTITY FULL;


--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    postal_codes text[] DEFAULT '{}'::text[] NOT NULL,
    fee_zar numeric(10,2) DEFAULT 0 NOT NULL,
    min_order_zar numeric(10,2) DEFAULT 0 NOT NULL,
    eta_minutes integer DEFAULT 45 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    contact_phone text,
    contact_email text,
    hours_text text,
    color text,
    image_url text,
    free_delivery_threshold_zar numeric(10,2) DEFAULT 0 NOT NULL,
    delivery_enabled boolean DEFAULT true NOT NULL,
    collection_enabled boolean DEFAULT false NOT NULL,
    collection_instructions text,
    collection_prep_minutes integer DEFAULT 20 NOT NULL,
    collection_address text
);

ALTER TABLE ONLY public.delivery_zones REPLICA IDENTITY FULL;


--
-- Name: delivery_zones_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.delivery_zones_public WITH (security_invoker='true') AS
 SELECT id,
    slug,
    name,
    description,
    fee_zar,
    min_order_zar,
    eta_minutes,
    hours_text,
    color,
    postal_codes,
    sort_order,
    image_url,
    delivery_enabled,
    collection_enabled,
    collection_instructions,
    collection_prep_minutes,
    collection_address
   FROM public.delivery_zones
  WHERE (is_active = true);


--
-- Name: discounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    target_type text NOT NULL,
    target_slug text NOT NULL,
    percent_off numeric(5,2) NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT discounts_percent_off_check CHECK (((percent_off > (0)::numeric) AND (percent_off <= (100)::numeric))),
    CONSTRAINT discounts_target_type_check CHECK ((target_type = ANY (ARRAY['product'::text, 'category'::text])))
);

ALTER TABLE ONLY public.discounts REPLICA IDENTITY FULL;


--
-- Name: featured_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_slug text NOT NULL,
    placement text DEFAULT 'home'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT featured_items_placement_check CHECK ((placement = ANY (ARRAY['home'::text, 'menu'::text, 'desserts'::text, 'offers'::text])))
);

ALTER TABLE ONLY public.featured_items REPLICA IDENTITY FULL;


--
-- Name: home_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    subtitle text,
    image_url text,
    cta_label text,
    cta_href text,
    zone_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.home_banners REPLICA IDENTITY FULL;


--
-- Name: home_content_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_content_events (
    id bigint NOT NULL,
    content_type text NOT NULL,
    content_id uuid NOT NULL,
    event_type text NOT NULL,
    zone_id uuid,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: home_content_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.home_content_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: home_content_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.home_content_events_id_seq OWNED BY public.home_content_events.id;


--
-- Name: home_desserts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_desserts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    price text,
    product_slug text,
    category text,
    zone_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.home_desserts REPLICA IDENTITY FULL;


--
-- Name: home_hot_deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_hot_deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    product_slug text,
    original_price numeric,
    discounted_price numeric,
    discount_pct integer,
    label text,
    zone_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.home_hot_deals REPLICA IDENTITY FULL;


--
-- Name: home_popular_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_popular_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    price text,
    product_slug text,
    category text,
    zone_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.home_popular_items REPLICA IDENTITY FULL;


--
-- Name: home_section_visibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_section_visibility (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section text NOT NULL,
    zone_id uuid,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.home_section_visibility REPLICA IDENTITY FULL;


--
-- Name: home_specials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_specials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    price text,
    product_slugs text[] DEFAULT '{}'::text[] NOT NULL,
    kind text DEFAULT 'special'::text NOT NULL,
    zone_id uuid,
    "position" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.home_specials REPLICA IDENTITY FULL;


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    display_name text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    status text DEFAULT 'disconnected'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_checked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT integrations_status_chk CHECK ((status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text, 'pending'::text])))
);

ALTER TABLE ONLY public.integrations REPLICA IDENTITY FULL;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_slug text NOT NULL,
    type text NOT NULL,
    quantity integer NOT NULL,
    balance_after integer NOT NULL,
    reason text,
    actor_id uuid,
    actor_email text,
    order_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_movements_type_check CHECK ((type = ANY (ARRAY['restock'::text, 'sale'::text, 'adjustment'::text, 'return'::text])))
);

ALTER TABLE ONLY public.inventory_movements REPLICA IDENTITY FULL;


--
-- Name: loyalty_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_accounts (
    user_id uuid NOT NULL,
    program_id uuid,
    points_balance integer DEFAULT 0 NOT NULL,
    lifetime_points integer DEFAULT 0 NOT NULL,
    tier text DEFAULT 'bronze'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.loyalty_accounts REPLICA IDENTITY FULL;


--
-- Name: loyalty_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    points_per_zar numeric(8,4) DEFAULT 1 NOT NULL,
    redemption_rate_zar numeric(8,4) DEFAULT 0.05 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.loyalty_programs REPLICA IDENTITY FULL;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    body text,
    category text DEFAULT 'general'::text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.notifications REPLICA IDENTITY FULL;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_slug text,
    title_snapshot text NOT NULL,
    quantity integer NOT NULL,
    unit_price_zar numeric(10,2) NOT NULL,
    line_total_zar numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    extras jsonb DEFAULT '[]'::jsonb NOT NULL,
    extras_total_zar numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);

ALTER TABLE ONLY public.order_items REPLICA IDENTITY FULL;


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_number_seq
    START WITH 10293
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text DEFAULT ('SL-'::text || nextval('public.order_number_seq'::regclass)) NOT NULL,
    user_id uuid,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    address text,
    notes text,
    subtotal_zar numeric(10,2) DEFAULT 0 NOT NULL,
    delivery_zar numeric(10,2) DEFAULT 0 NOT NULL,
    total_zar numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paystack_reference text,
    delivery_zone_id uuid,
    delivery_zone_name text,
    fulfillment_method text DEFAULT 'delivery'::text NOT NULL,
    collection_location text,
    estimated_minutes integer,
    CONSTRAINT orders_fulfillment_method_check CHECK ((fulfillment_method = ANY (ARRAY['delivery'::text, 'collection'::text])))
);

ALTER TABLE ONLY public.orders REPLICA IDENTITY FULL;


--
-- Name: pizza_toppings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pizza_toppings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    price_zar numeric(10,2) DEFAULT 0 NOT NULL,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_slug text NOT NULL,
    name text NOT NULL,
    description text,
    portion text,
    price_zar numeric DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_sizes_price_zar_check CHECK ((price_zar >= (0)::numeric))
);

ALTER TABLE ONLY public.product_sizes REPLICA IDENTITY FULL;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    price_zar numeric(10,2) DEFAULT 0 NOT NULL,
    category_slug text NOT NULL,
    image text,
    allergens text,
    nutrition text,
    portion text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    low_stock_threshold integer DEFAULT 5 NOT NULL,
    price_medium_zar numeric,
    price_large_zar numeric,
    ingredients text[] DEFAULT '{}'::text[] NOT NULL,
    calories integer,
    fat_g numeric(6,2),
    carbs_g numeric(6,2),
    protein_g numeric(6,2),
    size_selection_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT products_nutrition_non_negative CHECK ((((calories IS NULL) OR (calories >= 0)) AND ((fat_g IS NULL) OR (fat_g >= (0)::numeric)) AND ((carbs_g IS NULL) OR (carbs_g >= (0)::numeric)) AND ((protein_g IS NULL) OR (protein_g >= (0)::numeric))))
);

ALTER TABLE ONLY public.products REPLICA IDENTITY FULL;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    theme text DEFAULT 'system'::text NOT NULL,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    notification_prefs jsonb DEFAULT '{"sms": {"orders": false, "account": false, "security": true, "promotions": false}, "push": {"orders": true, "account": true, "security": true, "promotions": false}, "email": {"orders": true, "account": true, "security": true, "promotions": false}}'::jsonb NOT NULL
);


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    type text NOT NULL,
    value numeric(10,2) DEFAULT 0 NOT NULL,
    min_subtotal_zar numeric(10,2) DEFAULT 0 NOT NULL,
    usage_limit integer,
    times_used integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT promotions_type_check CHECK ((type = ANY (ARRAY['percent'::text, 'fixed'::text, 'free_delivery'::text, 'bogo'::text])))
);

ALTER TABLE ONLY public.promotions REPLICA IDENTITY FULL;


--
-- Name: reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    phone text,
    party_size integer NOT NULL,
    reserved_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reservations_party_size_check CHECK ((party_size > 0)),
    CONSTRAINT reservations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'seated'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])))
);

ALTER TABLE ONLY public.reservations REPLICA IDENTITY FULL;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product_slug text,
    author_name text NOT NULL,
    rating integer NOT NULL,
    comment text,
    status public.review_status DEFAULT 'pending'::public.review_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

ALTER TABLE ONLY public.reviews REPLICA IDENTITY FULL;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role public.app_role NOT NULL,
    permission public.app_permission NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_hours (
    day_of_week integer NOT NULL,
    opens_at time without time zone,
    closes_at time without time zone,
    is_closed boolean DEFAULT false NOT NULL,
    note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT store_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

ALTER TABLE ONLY public.store_hours REPLICA IDENTITY FULL;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    group_key text NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    description text,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.system_settings REPLICA IDENTITY FULL;


--
-- Name: user_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text DEFAULT 'Home'::text NOT NULL,
    recipient text,
    phone text,
    line1 text NOT NULL,
    line2 text,
    city text NOT NULL,
    province text,
    postal_code text,
    country text DEFAULT 'ZA'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.user_addresses REPLICA IDENTITY FULL;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_zone_id uuid
);


--
-- Name: home_content_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_content_events ALTER COLUMN id SET DEFAULT nextval('public.home_content_events_id_seq'::regclass);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION adjust_product_stock(_slug text, _delta integer, _type text, _reason text, _order_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.adjust_product_stock(_slug text, _delta integer, _type text, _reason text, _order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.adjust_product_stock(_slug text, _delta integer, _type text, _reason text, _order_id uuid) TO service_role;


--
-- Name: FUNCTION check_stock_availability(_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_stock_availability(_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_stock_availability(_items jsonb) TO service_role;


--
-- Name: FUNCTION get_user_zone(_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_zone(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_zone(_uid uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION is_main_admin(_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_main_admin(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_main_admin(_uid uuid) TO service_role;


--
-- Name: FUNCTION is_zone_admin(_uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_zone_admin(_uid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_zone_admin(_uid uuid) TO service_role;


--
-- Name: FUNCTION log_audit_event(_action text, _entity text, _entity_id text, _metadata jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.log_audit_event(_action text, _entity text, _entity_id text, _metadata jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_audit_event(_action text, _entity text, _entity_id text, _metadata jsonb) TO service_role;


--
-- Name: FUNCTION notify_admin_on_new_order(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_admin_on_new_order() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_admin_on_new_order() TO service_role;


--
-- Name: FUNCTION notify_customer_on_new_order(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_customer_on_new_order() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_customer_on_new_order() TO service_role;


--
-- Name: FUNCTION notify_customer_on_order_status_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notify_customer_on_order_status_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notify_customer_on_order_status_change() TO service_role;


--
-- Name: FUNCTION process_order_stock_deduction(_order_id uuid, _items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.process_order_stock_deduction(_order_id uuid, _items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.process_order_stock_deduction(_order_id uuid, _items jsonb) TO service_role;


--
-- Name: FUNCTION rollback_order_stock(_order_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.rollback_order_stock(_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.rollback_order_stock(_order_id uuid) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION user_addresses_enforce_single_default(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_addresses_enforce_single_default() TO anon;
GRANT ALL ON FUNCTION public.user_addresses_enforce_single_default() TO authenticated;
GRANT ALL ON FUNCTION public.user_addresses_enforce_single_default() TO service_role;


--
-- Name: FUNCTION user_roles_validate_zone(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_roles_validate_zone() TO anon;
GRANT ALL ON FUNCTION public.user_roles_validate_zone() TO authenticated;
GRANT ALL ON FUNCTION public.user_roles_validate_zone() TO service_role;


--
-- Name: TABLE admin_presence; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_presence TO anon;
GRANT ALL ON TABLE public.admin_presence TO authenticated;
GRANT ALL ON TABLE public.admin_presence TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE banners; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.banners TO anon;
GRANT ALL ON TABLE public.banners TO authenticated;
GRANT ALL ON TABLE public.banners TO service_role;


--
-- Name: TABLE categories; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.categories TO anon;
GRANT ALL ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;


--
-- Name: TABLE content_pages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.content_pages TO anon;
GRANT ALL ON TABLE public.content_pages TO authenticated;
GRANT ALL ON TABLE public.content_pages TO service_role;


--
-- Name: TABLE delivery_zones; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.delivery_zones TO anon;
GRANT ALL ON TABLE public.delivery_zones TO authenticated;
GRANT ALL ON TABLE public.delivery_zones TO service_role;


--
-- Name: COLUMN delivery_zones.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(id) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.slug; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(slug) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(slug) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(name) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(name) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.postal_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(postal_codes) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(postal_codes) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.fee_zar; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(fee_zar) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(fee_zar) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.min_order_zar; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(min_order_zar) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(min_order_zar) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.eta_minutes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(eta_minutes) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(eta_minutes) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.is_active; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_active) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(is_active) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sort_order) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(sort_order) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(created_at) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(updated_at) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(description) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(description) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.contact_phone; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(contact_phone) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(contact_phone) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.contact_email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(contact_email) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(contact_email) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.hours_text; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(hours_text) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(hours_text) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.color; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(color) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(color) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.image_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(image_url) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(image_url) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.free_delivery_threshold_zar; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(free_delivery_threshold_zar) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(free_delivery_threshold_zar) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.delivery_enabled; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(delivery_enabled) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(delivery_enabled) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.collection_enabled; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(collection_enabled) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(collection_enabled) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.collection_instructions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(collection_instructions) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(collection_instructions) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.collection_prep_minutes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(collection_prep_minutes) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(collection_prep_minutes) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: COLUMN delivery_zones.collection_address; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(collection_address) ON TABLE public.delivery_zones TO anon;
GRANT SELECT(collection_address) ON TABLE public.delivery_zones TO authenticated;


--
-- Name: TABLE delivery_zones_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.delivery_zones_public TO anon;
GRANT ALL ON TABLE public.delivery_zones_public TO authenticated;
GRANT ALL ON TABLE public.delivery_zones_public TO service_role;


--
-- Name: TABLE discounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.discounts TO anon;
GRANT ALL ON TABLE public.discounts TO authenticated;
GRANT ALL ON TABLE public.discounts TO service_role;


--
-- Name: TABLE featured_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.featured_items TO anon;
GRANT ALL ON TABLE public.featured_items TO authenticated;
GRANT ALL ON TABLE public.featured_items TO service_role;


--
-- Name: TABLE home_banners; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.home_banners TO anon;
GRANT ALL ON TABLE public.home_banners TO authenticated;
GRANT ALL ON TABLE public.home_banners TO service_role;


--
-- Name: TABLE home_content_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.home_content_events TO anon;
GRANT ALL ON TABLE public.home_content_events TO authenticated;
GRANT ALL ON TABLE public.home_content_events TO service_role;


--
-- Name: SEQUENCE home_content_events_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.home_content_events_id_seq TO anon;
GRANT ALL ON SEQUENCE public.home_content_events_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.home_content_events_id_seq TO service_role;


--
-- Name: TABLE home_desserts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.home_desserts TO anon;
GRANT ALL ON TABLE public.home_desserts TO authenticated;
GRANT ALL ON TABLE public.home_desserts TO service_role;


--
-- Name: TABLE home_hot_deals; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.home_hot_deals TO anon;
GRANT ALL ON TABLE public.home_hot_deals TO authenticated;
GRANT ALL ON TABLE public.home_hot_deals TO service_role;


--
-- Name: TABLE home_popular_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.home_popular_items TO anon;
GRANT ALL ON TABLE public.home_popular_items TO authenticated;
GRANT ALL ON TABLE public.home_popular_items TO service_role;


--
-- Name: TABLE home_section_visibility; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.home_section_visibility TO anon;
GRANT ALL ON TABLE public.home_section_visibility TO authenticated;
GRANT ALL ON TABLE public.home_section_visibility TO service_role;


--
-- Name: TABLE home_specials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.home_specials TO anon;
GRANT ALL ON TABLE public.home_specials TO authenticated;
GRANT ALL ON TABLE public.home_specials TO service_role;


--
-- Name: TABLE integrations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.integrations TO anon;
GRANT ALL ON TABLE public.integrations TO authenticated;
GRANT ALL ON TABLE public.integrations TO service_role;


--
-- Name: TABLE inventory_movements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inventory_movements TO anon;
GRANT ALL ON TABLE public.inventory_movements TO authenticated;
GRANT ALL ON TABLE public.inventory_movements TO service_role;


--
-- Name: TABLE loyalty_accounts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.loyalty_accounts TO anon;
GRANT ALL ON TABLE public.loyalty_accounts TO authenticated;
GRANT ALL ON TABLE public.loyalty_accounts TO service_role;


--
-- Name: TABLE loyalty_programs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.loyalty_programs TO anon;
GRANT ALL ON TABLE public.loyalty_programs TO authenticated;
GRANT ALL ON TABLE public.loyalty_programs TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


--
-- Name: SEQUENCE order_number_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.order_number_seq TO anon;
GRANT ALL ON SEQUENCE public.order_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.order_number_seq TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: TABLE pizza_toppings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pizza_toppings TO anon;
GRANT ALL ON TABLE public.pizza_toppings TO authenticated;
GRANT ALL ON TABLE public.pizza_toppings TO service_role;


--
-- Name: TABLE product_sizes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.product_sizes TO anon;
GRANT ALL ON TABLE public.product_sizes TO authenticated;
GRANT ALL ON TABLE public.product_sizes TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: COLUMN products.slug; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(slug) ON TABLE public.products TO anon;
GRANT SELECT(slug) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.title; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(title) ON TABLE public.products TO anon;
GRANT SELECT(title) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.description; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(description) ON TABLE public.products TO anon;
GRANT SELECT(description) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.price_zar; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(price_zar) ON TABLE public.products TO anon;
GRANT SELECT(price_zar) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.category_slug; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(category_slug) ON TABLE public.products TO anon;
GRANT SELECT(category_slug) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.image; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(image) ON TABLE public.products TO anon;
GRANT SELECT(image) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.allergens; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(allergens) ON TABLE public.products TO anon;
GRANT SELECT(allergens) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.nutrition; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(nutrition) ON TABLE public.products TO anon;
GRANT SELECT(nutrition) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.portion; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(portion) ON TABLE public.products TO anon;
GRANT SELECT(portion) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.is_active; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(is_active) ON TABLE public.products TO anon;
GRANT SELECT(is_active) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.sort_order; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(sort_order) ON TABLE public.products TO anon;
GRANT SELECT(sort_order) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.products TO anon;
GRANT SELECT(created_at) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.products TO anon;
GRANT SELECT(updated_at) ON TABLE public.products TO authenticated;


--
-- Name: COLUMN products.stock; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(stock) ON TABLE public.products TO service_role;


--
-- Name: COLUMN products.low_stock_threshold; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(low_stock_threshold) ON TABLE public.products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE promotions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.promotions TO service_role;


--
-- Name: TABLE reservations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reservations TO anon;
GRANT ALL ON TABLE public.reservations TO authenticated;
GRANT ALL ON TABLE public.reservations TO service_role;


--
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reviews TO anon;
GRANT ALL ON TABLE public.reviews TO authenticated;
GRANT ALL ON TABLE public.reviews TO service_role;


--
-- Name: TABLE role_permissions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.role_permissions TO anon;
GRANT ALL ON TABLE public.role_permissions TO authenticated;
GRANT ALL ON TABLE public.role_permissions TO service_role;


--
-- Name: TABLE store_hours; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.store_hours TO anon;
GRANT ALL ON TABLE public.store_hours TO authenticated;
GRANT ALL ON TABLE public.store_hours TO service_role;


--
-- Name: TABLE system_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.system_settings TO anon;
GRANT ALL ON TABLE public.system_settings TO authenticated;
GRANT ALL ON TABLE public.system_settings TO service_role;


--
-- Name: TABLE user_addresses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_addresses TO anon;
GRANT ALL ON TABLE public.user_addresses TO authenticated;
GRANT ALL ON TABLE public.user_addresses TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- PostgreSQL database dump complete
--


