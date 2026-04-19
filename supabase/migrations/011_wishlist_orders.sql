-- ============================================================
-- Wishlist + orders + order items (service_role via core-service)
-- ============================================================

CREATE TABLE wishlist (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  variant_id  UUID        NOT NULL REFERENCES product_variants (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, variant_id)
);

CREATE INDEX idx_wishlist_user_id ON wishlist (user_id);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_service_role_all"
  ON wishlist FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  invoice_number   TEXT        NOT NULL UNIQUE,
  total_amount     NUMERIC(12, 2) NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'pending',
  shipping_method  TEXT        NOT NULL
    CHECK (shipping_method IN ('home_delivery', 'self_pickup', 'pickup_point')),
  shipping_address JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_service_role_all"
  ON orders FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE order_items (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  variant_id         UUID        NOT NULL REFERENCES product_variants (id),
  quantity           INT         NOT NULL CHECK (quantity > 0),
  price_at_purchase  NUMERIC(12, 2) NOT NULL
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_service_role_all"
  ON order_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
