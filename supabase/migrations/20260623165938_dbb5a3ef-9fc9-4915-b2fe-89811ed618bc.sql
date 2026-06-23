-- Fix: restrict delivery_zones public reads to safe columns only.
-- Revoke table-level SELECT and grant only non-sensitive columns.
REVOKE SELECT ON public.delivery_zones FROM anon, authenticated;

GRANT SELECT (
  id, slug, name, postal_codes, fee_zar, min_order_zar, eta_minutes,
  is_active, sort_order, created_at, updated_at, description,
  hours_text, color, image_url
) ON public.delivery_zones TO anon, authenticated;

-- Fix: avatars storage SELECT policy must enforce ownership by folder name.
DROP POLICY IF EXISTS "avatars read" ON storage.objects;
CREATE POLICY "avatars read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
