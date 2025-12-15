-- Add pop_url column to expert_payments table for proof of payment attachments
ALTER TABLE public.expert_payments
ADD COLUMN pop_url TEXT DEFAULT NULL;

-- Add pop_file_name column to store original file name
ALTER TABLE public.expert_payments
ADD COLUMN pop_file_name TEXT DEFAULT NULL;

-- Create storage bucket for proof of payment documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('expert-pop-documents', 'expert-pop-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload POPs
CREATE POLICY "Users can upload POP documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'expert-pop-documents' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to view POP documents
CREATE POLICY "Users can view POP documents"
ON storage.objects
FOR SELECT
USING (bucket_id = 'expert-pop-documents' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete their uploaded POPs
CREATE POLICY "Users can delete POP documents"
ON storage.objects
FOR DELETE
USING (bucket_id = 'expert-pop-documents' AND auth.uid() IS NOT NULL);