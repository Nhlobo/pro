
-- Update short names to full profile names so data isolation works correctly
UPDATE public.attorney_pitchlog 
SET sales_person = 'Keamogetswe', updated_at = now()
WHERE LOWER(sales_person) IN ('kamo', 'keamo');

UPDATE public.attorney_pitchlog 
SET sales_person = 'Thokozile', updated_at = now()
WHERE LOWER(sales_person) IN ('thoko', 'thokozile');
