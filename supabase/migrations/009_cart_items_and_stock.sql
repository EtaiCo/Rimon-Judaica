-- ============================================================
-- Cart holds (3 days) + stock reservation
-- product_variants.stock_quantity already exists (001_initial_schema).
-- Optional: schedule check_and_release_stock() via pg_cron so stock
-- returns even if the user never opens the cart.
-- ============================================================

CREATE TABLE cart_items (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  variant_id  UUID        NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  quantity    INT         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days')
);

CREATE INDEX idx_cart_items_user_id ON cart_items (user_id);
CREATE INDEX idx_cart_items_expires_at ON cart_items (expires_at);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart_items_service_role_all"
  ON cart_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Restore stock for expired rows (aggregated per variant), then delete them.
CREATE OR REPLACE FUNCTION check_and_release_stock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH expired AS (
    SELECT id, variant_id, quantity
    FROM cart_items
    WHERE expires_at < now()
  ),
  agg AS (
    SELECT variant_id, SUM(quantity)::int AS total_qty
    FROM expired
    GROUP BY variant_id
  )
  UPDATE product_variants pv
  SET stock_quantity = pv.stock_quantity + agg.total_qty
  FROM agg
  WHERE pv.id = agg.variant_id;

  DELETE FROM cart_items
  WHERE expires_at < now();
END;
$$;

-- Atomic: lock variant row, verify stock, decrement, insert cart line.
CREATE OR REPLACE FUNCTION add_cart_item(
  p_user_id uuid,
  p_variant_id uuid,
  p_quantity int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock int;
BEGIN
  IF p_quantity < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity');
  END IF;

  SELECT stock_quantity INTO v_stock
  FROM product_variants
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'variant_not_found');
  END IF;

  IF v_stock < p_quantity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'out_of_stock');
  END IF;

  UPDATE product_variants
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_variant_id;

  INSERT INTO cart_items (user_id, variant_id, quantity, expires_at)
  VALUES (
    p_user_id,
    p_variant_id,
    p_quantity,
    now() + interval '3 days'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_release_stock() TO service_role;
GRANT EXECUTE ON FUNCTION add_cart_item(uuid, uuid, int) TO service_role;
