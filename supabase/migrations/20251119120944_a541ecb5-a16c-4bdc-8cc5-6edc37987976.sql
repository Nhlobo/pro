-- Ensure storage buckets exist with correct settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('aod-documents', 'aod-documents', false, 52428800, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('documents', 'documents', false, 52428800, ARRAY['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Authenticated users can upload AOD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view AOD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own AOD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documents" ON storage.objects;

-- AOD Documents Bucket Policies - Only authenticated users from company
CREATE POLICY "Company users can upload AOD documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'aod-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Company users can view all AOD documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'aod-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'employee', 'referring_attorney')
  )
);

CREATE POLICY "Company users can update AOD documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'aod-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'employee')
  )
);

CREATE POLICY "Company users can delete AOD documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'aod-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'employee')
  )
);

-- Documents Bucket Policies (for generated PDFs)
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');