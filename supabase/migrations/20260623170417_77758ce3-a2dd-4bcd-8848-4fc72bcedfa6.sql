-- Promotions: hide sensitive columns from public reads
REVOKE SELECT ON public.promotions FROM anon, authenticated;
GRANT SELECT (
  id, name, description, min_subtotal_zar,
  starts_at, ends_at, is_active, created_at, updated_at
) ON public.promotions TO anon, authenticated;

-- user_roles: pass auth.uid() to private.has_role
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- reviews: pass auth.uid() to private.has_role
DROP POLICY IF EXISTS "reviews public read approved" ON public.reviews;
CREATE POLICY "reviews public read approved"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (
    status = 'approved'::review_status
    OR auth.uid() = user_id
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );
