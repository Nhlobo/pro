-- Directly merge the duplicate "Mjulelwa Attorneys" records
-- First, identify the primary record (one with claimants: 802a79f8-8641-43a4-b361-61ce87a9fd35)
-- And the duplicate record (no claimants: 0dedbefb-c18c-496d-9a92-0cc6c620ef16)

-- Move any orphaned records from the duplicate to the primary
UPDATE public.claimants 
SET referring_attorney_id = '802a79f8-8641-43a4-b361-61ce87a9fd35' 
WHERE referring_attorney_id = '0dedbefb-c18c-496d-9a92-0cc6c620ef16';

UPDATE public.appointments 
SET referring_attorney_id = '802a79f8-8641-43a4-b361-61ce87a9fd35' 
WHERE referring_attorney_id = '0dedbefb-c18c-496d-9a92-0cc6c620ef16';

UPDATE public.aod_documents 
SET referring_attorney_id = '802a79f8-8641-43a4-b361-61ce87a9fd35' 
WHERE referring_attorney_id = '0dedbefb-c18c-496d-9a92-0cc6c620ef16';

UPDATE public.profiles 
SET referring_attorney_id = '802a79f8-8641-43a4-b361-61ce87a9fd35' 
WHERE referring_attorney_id = '0dedbefb-c18c-496d-9a92-0cc6c620ef16';

UPDATE public.documents 
SET referring_attorney_id = '802a79f8-8641-43a4-b361-61ce87a9fd35' 
WHERE referring_attorney_id = '0dedbefb-c18c-496d-9a92-0cc6c620ef16';

-- Delete the duplicate attorney
DELETE FROM public.referring_attorneys 
WHERE id = '0dedbefb-c18c-496d-9a92-0cc6c620ef16';