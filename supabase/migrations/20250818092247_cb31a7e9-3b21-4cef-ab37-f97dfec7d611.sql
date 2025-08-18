-- Update leads table to include new lead types for attorney specialization
ALTER TABLE public.leads 
DROP CONSTRAINT IF EXISTS leads_lead_type_check;

ALTER TABLE public.leads 
ADD CONSTRAINT leads_lead_type_check 
CHECK (lead_type IN (
  'plaintiff_attorney', 
  'defense_attorney', 
  'state_attorney', 
  'insurance_legal_dept', 
  'personal_injury_firm', 
  'medical_malpractice_firm', 
  'other'
));