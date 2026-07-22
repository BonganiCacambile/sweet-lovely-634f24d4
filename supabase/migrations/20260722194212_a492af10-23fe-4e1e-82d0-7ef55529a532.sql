
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ingredients text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS allergens   text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS calories    integer,
  ADD COLUMN IF NOT EXISTS fat_g       numeric(6,2),
  ADD COLUMN IF NOT EXISTS carbs_g     numeric(6,2),
  ADD COLUMN IF NOT EXISTS protein_g   numeric(6,2);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_nutrition_non_negative;
ALTER TABLE public.products
  ADD CONSTRAINT products_nutrition_non_negative CHECK (
    (calories  IS NULL OR calories  >= 0) AND
    (fat_g     IS NULL OR fat_g     >= 0) AND
    (carbs_g   IS NULL OR carbs_g   >= 0) AND
    (protein_g IS NULL OR protein_g >= 0)
  );
