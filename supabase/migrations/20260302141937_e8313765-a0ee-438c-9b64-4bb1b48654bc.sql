
-- Add deal tracking columns to attorney_pitchlog
ALTER TABLE public.attorney_pitchlog 
ADD COLUMN deal_closed boolean DEFAULT false,
ADD COLUMN deal_closed_date date DEFAULT NULL,
ADD COLUMN matched_referring_attorney_id uuid DEFAULT NULL;
