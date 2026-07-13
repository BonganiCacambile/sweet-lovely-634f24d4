DROP POLICY IF EXISTS "pizza_toppings public read" ON public.pizza_toppings;

CREATE POLICY "pizza_toppings anon read active"
  ON public.pizza_toppings FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "pizza_toppings auth read"
  ON public.pizza_toppings FOR SELECT
  TO authenticated
  USING (is_active = true OR private.has_role(auth.uid(), 'admin'));