
-- Merge "Kamo" into "Keamogetswe" in attorney_pitchlog
UPDATE public.attorney_pitchlog SET sales_person = 'Keamogetswe', updated_at = now() WHERE TRIM(sales_person) = 'Kamo';

-- Also merge in weekly summaries if any
UPDATE public.pitchlog_weekly_summaries SET sales_person = 'Keamogetswe', updated_at = now() WHERE TRIM(sales_person) = 'Kamo';
