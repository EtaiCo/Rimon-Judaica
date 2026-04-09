-- Add category images for homepage cards
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
