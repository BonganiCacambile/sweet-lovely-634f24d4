CREATE TABLE IF NOT EXISTS public.support_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_request_attachments_request_idx
  ON public.support_request_attachments(request_id);

GRANT SELECT, INSERT ON public.support_request_attachments TO authenticated;
GRANT ALL ON public.support_request_attachments TO service_role;

ALTER TABLE public.support_request_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments: owner select" ON public.support_request_attachments;
CREATE POLICY "attachments: owner select"
ON public.support_request_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.support_requests r
   WHERE r.id = request_id AND r.user_id = auth.uid()
));

DROP POLICY IF EXISTS "attachments: owner insert" ON public.support_request_attachments;
CREATE POLICY "attachments: owner insert"
ON public.support_request_attachments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_requests r
     WHERE r.id = request_id AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "attachments: admin select" ON public.support_request_attachments;
CREATE POLICY "attachments: admin select"
ON public.support_request_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.support_requests r
   WHERE r.id = request_id
     AND (private.is_main_admin(auth.uid())
          OR private.can_access_zone(auth.uid(), r.delivery_zone_id))
));

DROP POLICY IF EXISTS "support attachments: owner insert" ON storage.objects;
CREATE POLICY "support attachments: owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "support attachments: owner select" ON storage.objects;
CREATE POLICY "support attachments: owner select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR private.is_main_admin(auth.uid()))
);