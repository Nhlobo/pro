-- Add file upload columns to short_term_agreements table
ALTER TABLE short_term_agreements 
ADD COLUMN document_url text,
ADD COLUMN file_name text;

-- Create storage bucket for short-term agreement documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('short-term-agreements', 'short-term-agreements', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for short-term agreement documents
CREATE POLICY "Users can upload agreement documents for their law firm"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'short-term-agreements' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.law_firm_id IS NOT NULL
  )
);

CREATE POLICY "Users can view agreement documents from their law firm"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'short-term-agreements' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM profiles p1
    WHERE p1.id = auth.uid()
    AND p1.law_firm_id IS NOT NULL
  )
);

CREATE POLICY "Users can delete agreement documents from their law firm"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'short-term-agreements' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.law_firm_id IS NOT NULL
  )
);