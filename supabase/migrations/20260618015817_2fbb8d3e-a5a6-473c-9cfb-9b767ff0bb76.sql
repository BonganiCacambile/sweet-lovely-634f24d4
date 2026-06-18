-- Zone admins can read audit log rows tagged with their assigned zone_id
-- (logAudit stamps metadata.zone_id automatically for zone-scoped actors).
CREATE POLICY "audit zone admin read"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_zone_admin(auth.uid())
    AND (metadata->>'zone_id') = public.get_user_zone(auth.uid())::text
  );