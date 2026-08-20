CREATE TABLE IF NOT EXISTS public.support_reply_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  description text,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_reply_templates TO authenticated;
GRANT ALL ON public.support_reply_templates TO service_role;

ALTER TABLE public.support_reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read support reply templates" ON public.support_reply_templates;
CREATE POLICY "Admins can read support reply templates"
  ON public.support_reply_templates FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage support reply templates" ON public.support_reply_templates;
CREATE POLICY "Admins can manage support reply templates"
  ON public.support_reply_templates FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS support_reply_templates_set_updated_at ON public.support_reply_templates;
CREATE TRIGGER support_reply_templates_set_updated_at
  BEFORE UPDATE ON public.support_reply_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS support_reply_templates_order_idx
  ON public.support_reply_templates (sort_order, created_at);

INSERT INTO public.support_reply_templates (label, description, body, sort_order)
SELECT * FROM (VALUES
  ('Acknowledge', 'Confirm we received the request', E'Hi {{name}},\n\nThanks for reaching out to Sweet ''n Lovely. We''ve received your message (ref {{reference}}) and our team is looking into it now. We''ll get back to you shortly.\n\nWarm regards,\nSweet ''n Lovely Support', 10),
  ('Order issue', 'Investigating an order problem', E'Hi {{name}},\n\nWe''re sorry your order didn''t go as planned. We''re checking the details with the kitchen and delivery team and will confirm the outcome as soon as we have it (ref {{reference}}).\n\nWarm regards,\nSweet ''n Lovely Support', 20),
  ('Refund approved', 'Confirm a refund is on the way', E'Hi {{name}},\n\nWe''ve approved a refund for your order. Depending on your bank it can take 3-5 working days to reflect on {{email}}. Ref {{reference}}.\n\nApologies for the inconvenience,\nSweet ''n Lovely Support', 30),
  ('Need more info', 'Ask for extra details', E'Hi {{name}},\n\nThanks for your message. To help us resolve this quickly, could you please reply with your order number and the date/time of the order?\n\nThanks,\nSweet ''n Lovely Support', 40),
  ('Resolved', 'Close the request politely', E'Hi {{name}},\n\nGood news - your request (ref {{reference}}) has been resolved. If anything else comes up, just reply here and we''ll be happy to help.\n\nEnjoy your next slice,\nSweet ''n Lovely Support', 50)
) AS seed(label, description, body, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.support_reply_templates);