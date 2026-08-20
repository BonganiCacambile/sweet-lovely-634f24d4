ALTER TABLE public.support_request_attachments
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scan_result text,
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz;

CREATE INDEX IF NOT EXISTS support_request_attachments_scan_status_idx
  ON public.support_request_attachments(scan_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'support_request_attachments_scan_status_chk'
  ) THEN
    ALTER TABLE public.support_request_attachments
      ADD CONSTRAINT support_request_attachments_scan_status_chk
      CHECK (scan_status IN ('pending','scanning','clean','infected','error'));
  END IF;
END $$;

-- Existing rows predate scanning; mark them so they are re-checked, not trusted.
UPDATE public.support_request_attachments
   SET scan_status = 'pending'
 WHERE scan_status IS NULL;