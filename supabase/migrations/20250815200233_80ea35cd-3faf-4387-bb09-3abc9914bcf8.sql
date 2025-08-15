-- Create storage bucket for expert documents
INSERT INTO storage.buckets (id, name, public) VALUES ('expert-documents', 'expert-documents', false);

-- Create storage policies for expert documents
CREATE POLICY "Authenticated users can upload expert documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'expert-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view expert documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'expert-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update expert documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'expert-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete expert documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'expert-documents' AND auth.uid() IS NOT NULL);

-- Add CV document field to medical_experts table
ALTER TABLE medical_experts ADD COLUMN cv_document_url TEXT;