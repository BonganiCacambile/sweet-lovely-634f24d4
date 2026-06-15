
-- 1) Products inventory columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

-- 2) Extend order_status enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'order_status'::regtype AND enumlabel = 'processing') THEN
    ALTER TYPE order_status ADD VALUE 'processing';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'order_status'::regtype AND enumlabel = 'completed') THEN
    ALTER TYPE order_status ADD VALUE 'completed';
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'order_status'::regtype AND enumlabel = 'refunded') THEN
    ALTER TYPE order_status ADD VALUE 'refunded';
  END IF;
END $$;

-- 3) inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_slug text NOT NULL REFERENCES public.products(slug) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('restock','sale','adjustment','return')),
  quantity integer NOT NULL,
  balance_after integer NOT NULL,
  reason text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON public.inventory_movements(created_at DESC);

GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_movements admin read" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin read" ON public.inventory_movements
  FOR SELECT TO authenticated USING (private.has_role('admin'::app_role));
DROP POLICY IF EXISTS "inventory_movements admin insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements admin insert" ON public.inventory_movements
  FOR INSERT TO authenticated WITH CHECK (private.has_role('admin'::app_role));

-- 4) log_audit_event helper
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _entity text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, jsonb) TO authenticated;

-- 5) adjust_product_stock RPC (admin only)
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  _slug text,
  _delta integer,
  _type text,
  _reason text DEFAULT NULL,
  _order_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, private
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
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(text, integer, text, text, uuid) TO authenticated;

-- 6) Permissions system
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'orders.read','orders.write','orders.refund',
    'products.read','products.write',
    'categories.read','categories.write',
    'inventory.read','inventory.write',
    'reviews.read','reviews.moderate',
    'users.read','users.write',
    'roles.read','roles.write',
    'audit.read',
    'content.read','content.write',
    'notifications.read','notifications.write',
    'reports.read',
    'analytics.read',
    'integrations.read','integrations.write',
    'security.read','security.write',
    'settings.read','settings.write'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions read" ON public.role_permissions;
CREATE POLICY "role_permissions read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "role_permissions admin write" ON public.role_permissions;
CREATE POLICY "role_permissions admin write" ON public.role_permissions
  FOR ALL TO authenticated
  USING (private.has_role('admin'::app_role))
  WITH CHECK (private.has_role('admin'::app_role));

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id AND rp.permission = _permission
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, app_permission) TO authenticated;

-- Seed: admin role gets every permission
INSERT INTO public.role_permissions (role, permission)
SELECT 'admin'::app_role, p::app_permission
FROM unnest(enum_range(NULL::public.app_permission)) AS p
ON CONFLICT DO NOTHING;

-- 7) Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_movements REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
