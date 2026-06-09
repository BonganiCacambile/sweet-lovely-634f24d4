CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(public.app_role) TO service_role;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated;

ALTER POLICY "Admins manage roles" ON public.user_roles
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "Users read own roles" ON public.user_roles
  USING ((user_id = auth.uid()) OR private.has_role('admin'::public.app_role));

ALTER POLICY "Users view own profile" ON public.profiles
  USING ((auth.uid() = id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "audit admin insert" ON public.audit_logs
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "audit admin read" ON public.audit_logs
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "categories admin write" ON public.categories
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "notifications admin delete" ON public.notifications
  USING (private.has_role('admin'::public.app_role) OR (auth.uid() = user_id));

ALTER POLICY "notifications admin insert" ON public.notifications
  WITH CHECK (private.has_role('admin'::public.app_role) OR (auth.uid() = user_id));

ALTER POLICY "notifications own read" ON public.notifications
  USING ((auth.uid() = user_id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "order_items admin delete" ON public.order_items
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "order_items admin update" ON public.order_items
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "order_items read via order" ON public.order_items
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND ((o.user_id = auth.uid()) OR private.has_role('admin'::public.app_role))
  ));

ALTER POLICY "order_items write via order" ON public.order_items
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND ((o.user_id = auth.uid()) OR private.has_role('admin'::public.app_role))
  ));

ALTER POLICY "orders admin delete" ON public.orders
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "orders admin update" ON public.orders
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "orders user insert own" ON public.orders
  WITH CHECK ((auth.uid() = user_id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "orders user read own" ON public.orders
  USING ((auth.uid() = user_id) OR private.has_role('admin'::public.app_role));

ALTER POLICY "products admin write" ON public.products
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "products public read active" ON public.products
  USING (is_active OR private.has_role('admin'::public.app_role));

ALTER POLICY "reviews admin delete" ON public.reviews
  USING (private.has_role('admin'::public.app_role));

ALTER POLICY "reviews admin manage" ON public.reviews
  USING (private.has_role('admin'::public.app_role))
  WITH CHECK (private.has_role('admin'::public.app_role));

ALTER POLICY "reviews public read approved" ON public.reviews
  USING ((status = 'approved'::public.review_status) OR (auth.uid() = user_id) OR private.has_role('admin'::public.app_role));