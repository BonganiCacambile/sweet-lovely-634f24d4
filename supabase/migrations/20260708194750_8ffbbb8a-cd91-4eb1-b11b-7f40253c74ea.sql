
-- Dedupe existing rows keeping latest per (section, zone_id) treating NULL zones as equal
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY section, COALESCE(zone_id::text, 'null') ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM public.home_section_visibility
)
DELETE FROM public.home_section_visibility WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE public.home_section_visibility DROP CONSTRAINT IF EXISTS home_section_visibility_section_zone_id_key;
ALTER TABLE public.home_section_visibility ADD CONSTRAINT home_section_visibility_section_zone_id_key UNIQUE NULLS NOT DISTINCT (section, zone_id);
