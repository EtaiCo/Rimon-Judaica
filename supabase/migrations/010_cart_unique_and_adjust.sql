-- ============================================================
-- One row per (user_id, variant_id); upsert add_cart_item;
-- remove_cart_item + decrement_cart_item (restore stock atomically).
-- ============================================================

-- 1) Merge duplicate cart lines: keep MIN(id), sum quantities, refresh hold.
-- keep_id: PG has no min(uuid) aggregate on some versions; use text min then cast back.
UPDATE cart_items c
SET
  quantity = s.sum_q,
  expires_at = now() + interval '3 days'
FROM (
  SELECT
    user_id,
    variant_id,
    (MIN(id::text))::uuid AS keep_id,
    SUM(quantity)::int AS sum_q
  FROM cart_items
  GROUP BY user_id, variant_id
  HAVING COUNT(*) > 1
) s
WHERE c.id = s.keep_id;

DELETE FROM cart_items c
USING (
  SELECT
    user_id,
    variant_id,
    (MIN(id::text))::uuid AS keep_id
  FROM cart_items
  GROUP BY user_id, variant_id
  HAVING COUNT(*) > 1
) s
WHERE c.user_id = s.user_id
  AND c.variant_id = s.variant_id
  AND c.id <> s.keep_id;

-- 2) Enforce uniqueness
ALTER TABLE cart_items
  ADD CONSTRAINT cart_items_user_variant_unique UNIQUE (user_id, variant_id);

-- 3) Upserting add (increment quantity + refresh expires; single stock decrement per call)
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
  v_cart_id uuid;
  v_curr_qty int;
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

  SELECT id, quantity INTO v_cart_id, v_curr_qty
  FROM cart_items
  WHERE user_id = p_user_id AND variant_id = p_variant_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE cart_items
    SET
      quantity = v_curr_qty + p_quantity,
      expires_at = now() + interval '3 days'
    WHERE id = v_cart_id;
  ELSE
    INSERT INTO cart_items (user_id, variant_id, quantity, expires_at)
    VALUES (
      p_user_id,
      p_variant_id,
      p_quantity,
      now() + interval '3 days'
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 4) Remove line and restore full reserved quantity
CREATE OR REPLACE FUNCTION remove_cart_item(
  p_user_id uuid,
  p_cart_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r cart_items%ROWTYPE;
BEGIN
  SELECT * INTO r
  FROM cart_items
  WHERE id = p_cart_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.user_id IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  UPDATE product_variants
  SET stock_quantity = stock_quantity + r.quantity
  WHERE id = r.variant_id;

  DELETE FROM cart_items WHERE id = p_cart_item_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5) Decrement qty (restore p_amount to stock); remove row if qty would hit 0
CREATE OR REPLACE FUNCTION decrement_cart_item(
  p_user_id uuid,
  p_cart_item_id uuid,
  p_amount int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r cart_items%ROWTYPE;
BEGIN
  IF p_amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_quantity');
  END IF;

  SELECT * INTO r
  FROM cart_items
  WHERE id = p_cart_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.user_id IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF r.quantity <= p_amount THEN
    UPDATE product_variants
    SET stock_quantity = stock_quantity + r.quantity
    WHERE id = r.variant_id;

    DELETE FROM cart_items WHERE id = p_cart_item_id;
  ELSE
    UPDATE product_variants
    SET stock_quantity = stock_quantity + p_amount
    WHERE id = r.variant_id;

    UPDATE cart_items
    SET
      quantity = r.quantity - p_amount,
      expires_at = now() + interval '3 days'
    WHERE id = p_cart_item_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION add_cart_item(uuid, uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION remove_cart_item(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_cart_item(uuid, uuid, int) TO service_role;
