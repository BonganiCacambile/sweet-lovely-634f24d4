-- ============================================================
-- Sweet 'n Lovely Pizza — Step 11: Storage
-- Buckets + storage.objects RLS policies (idempotent, re-runnable)
-- Run AFTER 07_functions.sql. Files themselves are copied separately (see README).
-- ============================================================

-- 1) Buckets ---------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2) Ensure RLS is on (normally already enabled by Supabase) ----
-- NOTE: RLS is already enabled on storage.objects by Supabase, and your SQL
-- role is not the owner of that table, so running
--   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
-- fails with `42501: must be owner of table objects`. It is omitted on purpose.

-- 3) Policies --------------------------------------------------
-- Drop both legacy naming variants so re-runs never hit 42710.
DROP POLICY IF EXISTS "avatars read own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars insert own" ON storage.objects;
DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_read_own"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;

CREATE POLICY "avatars read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- End of 11_storage.sql
