-- Create storage bucket for sample reports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sample-reports', 'sample-reports', false);

-- Create RLS policies for sample reports bucket
CREATE POLICY "Allow authenticated users to upload sample reports" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'sample-reports' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to view sample reports" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'sample-reports' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to update their sample reports" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'sample-reports' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow authenticated users to delete sample reports" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'sample-reports' 
  AND auth.role() = 'authenticated'
);