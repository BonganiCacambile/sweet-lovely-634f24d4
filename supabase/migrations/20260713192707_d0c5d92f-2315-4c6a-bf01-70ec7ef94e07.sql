DROP POLICY IF EXISTS "pizza_toppings public read" ON public.pizza_toppings;
DROP POLICY IF EXISTS "pizza_toppings admin manage" ON public.pizza_toppings;

CREATE POLICY "pizza_toppings public read"
  ON public.pizza_toppings FOR SELECT
  USING (is_active = true OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "pizza_toppings admin manage"
  ON public.pizza_toppings FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));