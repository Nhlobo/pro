-- Rename law_firm_id to referring_attorney_id in short_term_agreements table
ALTER TABLE public.short_term_agreements 
RENAME COLUMN law_firm_id TO referring_attorney_id;