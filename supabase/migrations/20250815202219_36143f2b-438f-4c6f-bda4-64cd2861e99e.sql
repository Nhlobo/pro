-- Create attorneys/law firms table if not exists for referring attorney data
DO $$
BEGIN
    -- Check if we need to add columns to existing law_firms table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'law_firms' AND column_name = 'attorney_role') THEN
        ALTER TABLE public.law_firms 
        ADD COLUMN attorney_role text,
        ADD COLUMN province text,
        ADD COLUMN address text;
    END IF;
END $$;

-- Create storage bucket for attorney documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('attorney-documents', 'attorney-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for attorney documents
CREATE POLICY "Users can upload attorney documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'attorney-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view attorney documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'attorney-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update attorney documents" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'attorney-documents' AND auth.uid() IS NOT NULL);