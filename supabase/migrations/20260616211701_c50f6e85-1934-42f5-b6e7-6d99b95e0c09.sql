
-- Atomic order stock deduction + availability check, with realtime on products

CREATE OR REPLACE FUNCTION public.check_stock_availability(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_slug text;
  v_qty int;
  v_stock int;
  v_short jsonb := '[]'::jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    SELECT stock INTO v_stock FROM public.products WHERE slug = v_slug;
    IF v_stock IS NULL OR v_stock < v_qty THEN
      v_short := v_short || jsonb_build_object(
        'slug', v_slug,
        'requested', v_qty,
        'available', COALESCE(v_stock, 0)
      );
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', jsonb_array_length(v_short) = 0, 'shortages', v_short);
END $$;

GRANT EXECUTE ON FUNCTION public.check_stock_availability(jsonb) TO anon, authenticated, service_role;

-- Atomically locks each product row, validates stock, deducts, and writes an
-- inventory_movements log row per item. Raises on insufficient stock so the
-- caller transaction can react. Service-role only (called from server fn).
CREATE OR REPLACE FUNCTION public.process_order_stock_deduction(_order_id uuid, _items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_slug text;
  v_qty int;
  v_before int;
  v_after int;
  v_movements jsonb := '[]'::jsonb;
BEGIN
  -- Phase 1: lock + validate every row up-front so we never partially deduct.
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT stock INTO v_before
      FROM public.products
     WHERE slug = v_slug
     FOR UPDATE;

    IF v_before IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_slug USING ERRCODE = 'P0002';
    END IF;
    IF v_before < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, need %', v_slug, v_before, v_qty
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Phase 2: apply deductions + audit log.
  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_slug := item->>'slug';
    v_qty := COALESCE((item->>'quantity')::int, 0);
    IF v_slug IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.products
       SET stock = stock - v_qty,
           updated_at = now()
     WHERE slug = v_slug
     RETURNING stock INTO v_after;

    INSERT INTO public.inventory_movements
      (product_slug, type, quantity, balance_after, reason, order_id)
    VALUES
      (v_slug, 'sale', -v_qty, v_after,
       'Order ' || _order_id::text || ' deduction', _order_id);

    v_movements := v_movements || jsonb_build_object(
      'slug', v_slug,
      'before', v_after + v_qty,
      'deducted', v_qty,
      'after', v_after,
      'order_id', _order_id
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'movements', v_movements);
END $$;

REVOKE ALL ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.process_order_stock_deduction(uuid, jsonb) TO service_role;

-- Rollback for cancelled/failed orders. Adds stock back + writes a 'return'
-- movement row. Idempotent per order_id via the guard select.
CREATE OR REPLACE FUNCTION public.rollback_order_stock(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mov record;
  v_after int;
  v_movements jsonb := '[]'::jsonb;
BEGIN
  -- Guard: only rollback if a sale was previously recorded and not yet returned.
  IF EXISTS (
    SELECT 1 FROM public.inventory_movements
     WHERE order_id = _order_id AND type = 'return'
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_rolled_back', true);
  END IF;

  FOR mov IN
    SELECT product_slug, quantity
      FROM public.inventory_movements
     WHERE order_id = _order_id AND type = 'sale'
  LOOP
    UPDATE public.products
       SET stock = stock + ABS(mov.quantity),
           updated_at = now()
     WHERE slug = mov.product_slug
     RETURNING stock INTO v_after;

    INSERT INTO public.inventory_movements
      (product_slug, type, quantity, balance_after, reason, order_id)
    VALUES
      (mov.product_slug, 'return', ABS(mov.quantity), v_after,
       'Order ' || _order_id::text || ' rollback', _order_id);

    v_movements := v_movements || jsonb_build_object(
      'slug', mov.product_slug,
      'restored', ABS(mov.quantity),
      'after', v_after
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'movements', v_movements);
END $$;

REVOKE ALL ON FUNCTION public.rollback_order_stock(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rollback_order_stock(uuid) TO service_role;

-- Enable realtime so admin + customer views update instantly on stock changes.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products REPLICA IDENTITY FULL;
