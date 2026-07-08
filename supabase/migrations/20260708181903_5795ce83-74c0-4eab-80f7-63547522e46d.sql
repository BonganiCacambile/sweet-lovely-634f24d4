
CREATE POLICY "events public insert" ON public.home_content_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event_type IN ('view','click')
    AND content_type IN ('popular','hot_deal','special','banner','featured')
  );
