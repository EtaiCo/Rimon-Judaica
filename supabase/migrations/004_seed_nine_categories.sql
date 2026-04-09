-- Nine homepage root categories (alongside existing סידורים / טליתות from 002)
INSERT INTO categories (id, name, slug, parent_id, image_url) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'סט טלית ותפילין', 'set-tallit-tefilin', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%A1%D7%98+%D7%98%D7%9C%D7%99%D7%AA'),
  ('c2000000-0000-0000-0000-000000000002', 'מזוזות', 'mezuzot', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%9E%D7%96%D7%95%D7%96%D7%95%D7%AA'),
  ('c3000000-0000-0000-0000-000000000003', 'כיסויי חלה', 'challah-covers', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%9B%D7%99%D7%A1%D7%95%D7%99%D7%99+%D7%97%D7%9C%D7%94'),
  ('c4000000-0000-0000-0000-000000000004', 'פמוטים', 'pamin', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%A4%D7%9E%D7%95%D7%98%D7%99%D7%9D'),
  ('c5000000-0000-0000-0000-000000000005', 'ברכונים', 'birkonim', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%91%D7%A8%D7%9B%D7%95%D7%A0%D7%99%D7%9D'),
  ('c6000000-0000-0000-0000-000000000006', 'כיפות', 'kippot', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%9B%D7%99%D7%A4%D7%95%D7%AA'),
  ('c7000000-0000-0000-0000-000000000007', 'כיסויי פלטה', 'blech-covers', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%9B%D7%99%D7%A1%D7%95%D7%99+%D7%A4%D7%9C%D7%98%D7%94'),
  ('c8000000-0000-0000-0000-000000000008', 'גביעי קידוש', 'kiddush-cups', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%92%D7%91%D7%99%D7%A2%D7%99+%D7%A7%D7%99%D7%93%D7%95%D7%A9'),
  ('c9000000-0000-0000-0000-000000000009', 'נטילת ידיים', 'netilat-yadayim', NULL,
   'https://placehold.co/640x480/FDFDF9/002366?text=%D7%A0%D7%98%D7%99%D7%9C%D7%AA+%D7%99%D7%93%D7%99%D7%99%D7%9D');

-- Optional: placeholder images for legacy seed categories (if column exists after 003)
UPDATE categories SET image_url = 'https://placehold.co/640x480/FDFDF9/002366?text=%D7%A1%D7%99%D7%93%D7%95%D7%A8%D7%99%D7%9D'
  WHERE id = 'a1000000-0000-0000-0000-000000000001' AND (image_url IS NULL OR image_url = '');
UPDATE categories SET image_url = 'https://placehold.co/640x480/FDFDF9/002366?text=%D7%98%D7%9C%D7%99%D7%AA%D7%95%D7%AA'
  WHERE id = 'a2000000-0000-0000-0000-000000000002' AND (image_url IS NULL OR image_url = '');
