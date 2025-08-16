-- Create documents table for tracking all uploaded documents
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL, -- 'instruction_letter', 'claimant_id_copy', 'medical_records', 'expert_report'
  claimant_id UUID,
  referring_attorney_id UUID,
  appointment_id UUID,
  expert_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  upload_time TIME NOT NULL DEFAULT now()::time,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policies for document access
CREATE POLICY "Users can view documents from their law firm" 
ON public.documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.law_firm_id = (
    SELECT p2.law_firm_id FROM public.profiles p2 WHERE p2.id = documents.uploaded_by
  )
));

CREATE POLICY "Users can create documents for their law firm" 
ON public.documents 
FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update documents from their law firm" 
ON public.documents 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.law_firm_id = (
    SELECT p2.law_firm_id FROM public.profiles p2 WHERE p2.id = documents.uploaded_by
  )
));

-- Add foreign key constraints
ALTER TABLE public.documents
  ADD CONSTRAINT documents_claimant_id_fkey
    FOREIGN KEY (claimant_id)
    REFERENCES public.claimants(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT documents_referring_attorney_id_fkey
    FOREIGN KEY (referring_attorney_id)
    REFERENCES public.law_firms(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT documents_appointment_id_fkey
    FOREIGN KEY (appointment_id)
    REFERENCES public.appointments(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT documents_expert_id_fkey
    FOREIGN KEY (expert_id)
    REFERENCES public.medical_experts(id)
    ON DELETE SET NULL,
  ADD CONSTRAINT documents_uploaded_by_fkey
    FOREIGN KEY (uploaded_by)
    REFERENCES public.profiles(id)
    ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_documents_claimant_id ON public.documents(claimant_id);
CREATE INDEX idx_documents_referring_attorney_id ON public.documents(referring_attorney_id);
CREATE INDEX idx_documents_document_type ON public.documents(document_type);
CREATE INDEX idx_documents_upload_date ON public.documents(upload_date);

-- Create trigger for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();