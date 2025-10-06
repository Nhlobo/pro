-- Create storage bucket for AOD documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('aod-documents', 'aod-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create AOD documents table
CREATE TABLE IF NOT EXISTS public.aod_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES public.attorneys(id) ON DELETE CASCADE,
  law_firm_id UUID NOT NULL REFERENCES public.law_firms(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  payment_plan_structure TEXT,
  payment_due_date DATE,
  interest_rate_1_3_months NUMERIC(5,2),
  interest_rate_6_months NUMERIC(5,2),
  interest_rate_12_months NUMERIC(5,2),
  interest_rate_18_months NUMERIC(5,2),
  interest_rate_24_months NUMERIC(5,2),
  notes TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.aod_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for aod_documents
CREATE POLICY "Users can view AOD documents from their law firm"
  ON public.aod_documents
  FOR SELECT
  USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can create AOD documents for their law firm"
  ON public.aod_documents
  FOR INSERT
  WITH CHECK (
    law_firm_id = get_current_user_law_firm() 
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can update AOD documents from their law firm"
  ON public.aod_documents
  FOR UPDATE
  USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Users can delete AOD documents from their law firm"
  ON public.aod_documents
  FOR DELETE
  USING (law_firm_id = get_current_user_law_firm());

CREATE POLICY "Main admin full access to AOD documents"
  ON public.aod_documents
  FOR ALL
  USING (is_system_admin())
  WITH CHECK (is_system_admin());

-- Create storage policies for AOD documents
CREATE POLICY "Users can view AOD documents from their law firm"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'aod-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.aod_documents aod
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE aod.document_url = storage.objects.name
        AND aod.law_firm_id = p.law_firm_id
      )
      OR is_system_admin()
    )
  );

CREATE POLICY "Users can upload AOD documents for their law firm"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'aod-documents'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update AOD documents from their law firm"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'aod-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.aod_documents aod
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE aod.document_url = storage.objects.name
        AND aod.law_firm_id = p.law_firm_id
      )
      OR is_system_admin()
    )
  );

CREATE POLICY "Users can delete AOD documents from their law firm"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'aod-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.aod_documents aod
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE aod.document_url = storage.objects.name
        AND aod.law_firm_id = p.law_firm_id
      )
      OR is_system_admin()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_aod_documents_updated_at
  BEFORE UPDATE ON public.aod_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_aod_documents_attorney_id ON public.aod_documents(attorney_id);
CREATE INDEX idx_aod_documents_law_firm_id ON public.aod_documents(law_firm_id);