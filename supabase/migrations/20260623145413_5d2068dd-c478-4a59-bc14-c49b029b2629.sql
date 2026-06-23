
-- 1) Orders / order_items: remove direct INSERT for authenticated users.
--    Order creation now flows exclusively through the verified Paystack
--    server function, which uses the service role (bypasses RLS).
DROP POLICY IF EXISTS "orders user insert own" ON public.orders;
DROP POLICY IF EXISTS "order_items write via order" ON public.order_items;

-- 2) Delivery zones: hide staff contact columns from authenticated users
--    too (already revoked from anon). Admin reads use the service role.
REVOKE SELECT (contact_email, contact_phone) ON public.delivery_zones FROM authenticated;

-- 3) role_permissions: restrict read to admins only
DROP POLICY IF EXISTS "role_permissions read" ON public.role_permissions;
CREATE POLICY "role_permissions admin read"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
