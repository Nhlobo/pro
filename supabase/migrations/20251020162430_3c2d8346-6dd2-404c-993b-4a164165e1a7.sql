-- Create dedicated table for case management reports
CREATE TABLE IF NOT EXISTS public.case_management_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_id UUID NOT NULL REFERENCES public.claimants(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  uploaded_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.case_management_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view case management reports
CREATE POLICY "Users can view case management reports"
ON public.case_management_reports
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Policy: Allow authenticated users to insert case management reports
CREATE POLICY "Users can upload case management reports"
ON public.case_management_reports
FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

-- Policy: Allow users to delete their own uploaded reports
CREATE POLICY "Users can delete their own uploaded reports"
ON public.case_management_reports
FOR DELETE
USING (auth.uid() = uploaded_by);

-- Create storage bucket for case management reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-management-reports',
  'case-management-reports',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for case management reports
CREATE POLICY "Authenticated users can upload case reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-management-reports');

CREATE POLICY "Authenticated users can view case reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'case-management-reports');

CREATE POLICY "Users can delete their uploaded case reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'case-management-reports');

-- Add updated_at trigger
CREATE TRIGGER update_case_management_reports_updated_at
BEFORE UPDATE ON public.case_management_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();