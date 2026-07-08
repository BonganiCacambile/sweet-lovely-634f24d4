DROP POLICY IF EXISTS "Main admin can view all presence" ON public.admin_presence;

CREATE POLICY "Main admin can view all presence"
  ON public.admin_presence FOR SELECT
  TO authenticated
  USING (private.is_main_admin(auth.uid()));