
-- 1. Add zone_admin enum value (can't be used as ::app_role literal in same tx, so we use ::text comparisons below)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'zone_admin';

-- 2. Extend user_roles with optional zone assignment
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS assigned_zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;

-- One zone-admin assignment per user
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_zone_admin_unique
  ON public.user_roles (user_id)
  WHERE assigned_zone_id IS NOT NULL;

-- 3. Trigger: enforce role/assigned_zone_id consistency
CREATE OR REPLACE FUNCTION public.user_roles_validate_zone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

DROP TRIGGER IF EXISTS user_roles_validate_zone_trg ON public.user_roles;
CREATE TRIGGER user_roles_validate_zone_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.user_roles_validate_zone();

-- 4. Helper functions (column-based, so no enum literal needed in same tx)
CREATE OR REPLACE FUNCTION public.is_main_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_zone(_uid uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT assigned_zone_id
    FROM public.user_roles
   WHERE user_id = _uid
     AND assigned_zone_id IS NOT NULL
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_zone_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _uid AND assigned_zone_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_zone(_uid uuid, _zone_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_main_admin(_uid)
      OR public.get_user_zone(_uid) = _zone_id
$$;

GRANT EXECUTE ON FUNCTION public.is_main_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_zone(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_zone_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_zone(uuid, uuid) TO authenticated, anon;

-- 5. delivery_zones: allow zone-admin SELECT/UPDATE on their own zone
DROP POLICY IF EXISTS "Admins manage zones" ON public.delivery_zones;
DROP POLICY IF EXISTS "Zone admin reads own zone" ON public.delivery_zones;
DROP POLICY IF EXISTS "Zone admin updates own zone" ON public.delivery_zones;

CREATE POLICY "Main admin full access zones"
  ON public.delivery_zones FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "Zone admin reads own zone"
  ON public.delivery_zones FOR SELECT TO authenticated
  USING (id = public.get_user_zone(auth.uid()));

CREATE POLICY "Zone admin updates own zone"
  ON public.delivery_zones FOR UPDATE TO authenticated
  USING (id = public.get_user_zone(auth.uid()))
  WITH CHECK (id = public.get_user_zone(auth.uid()));

-- 6. orders: zone admin can read/update orders in their zone
DROP POLICY IF EXISTS "Zone admin reads zone orders" ON public.orders;
DROP POLICY IF EXISTS "Zone admin updates zone orders" ON public.orders;

CREATE POLICY "Zone admin reads zone orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    delivery_zone_id IS NOT NULL
    AND delivery_zone_id = public.get_user_zone(auth.uid())
  );

CREATE POLICY "Zone admin updates zone orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    delivery_zone_id IS NOT NULL
    AND delivery_zone_id = public.get_user_zone(auth.uid())
  )
  WITH CHECK (
    delivery_zone_id IS NOT NULL
    AND delivery_zone_id = public.get_user_zone(auth.uid())
  );

-- 7. order_items: zone admin can read items of orders in their zone
DROP POLICY IF EXISTS "Zone admin reads zone order items" ON public.order_items;
CREATE POLICY "Zone admin reads zone order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_items.order_id
         AND o.delivery_zone_id IS NOT NULL
         AND o.delivery_zone_id = public.get_user_zone(auth.uid())
    )
  );

-- 8. inventory_movements: zone admin reads movements for their zone's orders only
DROP POLICY IF EXISTS "Zone admin reads zone inventory" ON public.inventory_movements;
CREATE POLICY "Zone admin reads zone inventory"
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (
    order_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = inventory_movements.order_id
         AND o.delivery_zone_id = public.get_user_zone(auth.uid())
    )
  );

-- 9. user_roles: zone admin can read only their own row (existing policy already allows this via user_id = auth.uid()). No write changes.
