-- Full display name for customers (registration UI)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
