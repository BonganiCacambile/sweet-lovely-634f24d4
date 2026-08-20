CREATE TABLE IF NOT EXISTS public.support_request_replies (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  author_id uuid references auth.users(id),
  author_email text,
  body text not null,
  channel text not null default 'in_app',
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS support_request_replies_request_idx
  ON public.support_request_replies (request_id, created_at DESC);

GRANT SELECT, INSERT ON public.support_request_replies TO authenticated;
GRANT ALL ON public.support_request_replies TO service_role;

ALTER TABLE public.support_request_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view support replies" ON public.support_request_replies;
CREATE POLICY "Admins can view support replies"
  ON public.support_request_replies FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can add support replies" ON public.support_request_replies;
CREATE POLICY "Admins can add support replies"
  ON public.support_request_replies FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));