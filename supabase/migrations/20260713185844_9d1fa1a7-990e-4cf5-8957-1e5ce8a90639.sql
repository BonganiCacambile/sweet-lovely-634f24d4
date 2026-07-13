
-- pizza_toppings table
CREATE TABLE public.pizza_toppings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_zar numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  is_available boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pizza_toppings TO anon, authenticated;
GRANT ALL ON public.pizza_toppings TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.pizza_toppings TO authenticated;

ALTER TABLE public.pizza_toppings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active toppings"
  ON public.pizza_toppings FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage toppings"
  ON public.pizza_toppings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_pizza_toppings_updated
  BEFORE UPDATE ON public.pizza_toppings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pizza_toppings;

-- Extras on order items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS extras_total_zar numeric(10,2) NOT NULL DEFAULT 0;

-- Seed 11 toppings
INSERT INTO public.pizza_toppings (name, slug, price_zar, display_order) VALUES
  ('Cheese', 'cheese', 35, 10),
  ('Feta Cheese', 'feta-cheese', 26, 20),
  ('Ham', 'ham', 26, 30),
  ('Ribs', 'ribs', 35, 40),
  ('Salami', 'salami', 35, 50),
  ('Chicken', 'chicken', 35, 60),
  ('Mince', 'mince', 35, 70),
  ('Chorizo', 'chorizo', 35, 80),
  ('Bacon', 'bacon', 35, 90),
  ('Veggies', 'veggies', 20, 100),
  ('Beef', 'beef', 35, 110)
ON CONFLICT (slug) DO NOTHING;
