-- Create medical experts table for directory
CREATE TABLE public.medical_experts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  expert_type TEXT NOT NULL,
  province TEXT NOT NULL,
  contact_number TEXT,
  email TEXT,
  practice_address TEXT,
  consultation_fees DECIMAL(10,2),
  court_fees DECIMAL(10,2),
  personal_assistant_name TEXT,
  personal_assistant_contact TEXT,
  qualifications TEXT,
  years_experience INTEGER,
  specializations TEXT[],
  availability_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.medical_experts ENABLE ROW LEVEL SECURITY;

-- RLS policies for medical experts
CREATE POLICY "Authenticated users can view medical experts" 
ON public.medical_experts 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create medical experts" 
ON public.medical_experts 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update medical experts" 
ON public.medical_experts 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete medical experts" 
ON public.medical_experts 
FOR DELETE 
TO authenticated
USING (true);

-- Add trigger for timestamp updates
CREATE TRIGGER update_medical_experts_updated_at
BEFORE UPDATE ON public.medical_experts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample data
INSERT INTO public.medical_experts (
  first_name, last_name, expert_type, province, contact_number, email,
  practice_address, consultation_fees, court_fees, personal_assistant_name,
  personal_assistant_contact, qualifications, years_experience, specializations
) VALUES 
('Dr. John', 'Smith', 'Neurosurgeon', 'Gauteng', '+27-11-123-4567', 'j.smith@medexperts.co.za',
 '123 Medical Centre, Sandton', 2500.00, 5000.00, 'Sarah Johnson', '+27-11-123-4568',
 'MBChB, FCS(SA)', 15, ARRAY['Brain Surgery', 'Spinal Surgery']),
 
('Dr. Maria', 'Van der Merwe', 'Orthopaedic Surgeon', 'Western Cape', '+27-21-456-7890', 'm.vandermerwe@orthocape.co.za',
 '456 Ortho Clinic, Cape Town', 2200.00, 4500.00, 'Peter Adams', '+27-21-456-7891',
 'MBChB, FC Orth(SA)', 12, ARRAY['Joint Replacement', 'Sports Injuries']),
 
('Dr. Sipho', 'Mthembu', 'Clinical Psychologist', 'KwaZulu-Natal', '+27-31-789-0123', 's.mthembu@mindhealth.co.za',
 '789 Psychology Centre, Durban', 1800.00, 3500.00, 'Linda Nkomo', '+27-31-789-0124',
 'MA Psychology, PhD Clinical Psychology', 10, ARRAY['PTSD', 'Depression', 'Anxiety']),
 
('Dr. Fatima', 'Hassan', 'Psychiatrist', 'Gauteng', '+27-11-345-6789', 'f.hassan@psychcare.co.za',
 '321 Mental Health Clinic, Johannesburg', 2800.00, 5500.00, 'Ahmed Khan', '+27-11-345-6790',
 'MBChB, FC Psych(SA)', 18, ARRAY['Bipolar Disorder', 'Schizophrenia']),
 
('Dr. Pieter', 'Botha', 'Radiologist', 'Free State', '+27-51-234-5678', 'p.botha@radiology.co.za',
 '654 Imaging Centre, Bloemfontein', 2000.00, 4000.00, 'Anna Steyn', '+27-51-234-5679',
 'MBChB, FC Rad(SA)', 14, ARRAY['MRI', 'CT Scans', 'X-Ray']);