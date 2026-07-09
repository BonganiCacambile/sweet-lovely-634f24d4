ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS free_delivery_threshold_zar numeric(10,2) NOT NULL DEFAULT 0;