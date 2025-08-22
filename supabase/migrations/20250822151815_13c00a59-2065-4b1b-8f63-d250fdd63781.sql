-- Fix document information security vulnerability
-- Drop existing policies that may be too permissive
DROP POLICY IF EXISTS "Users can create documents for their law firm" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents from their law firm" ON public.documents;
DROP POLICY IF EXISTS "Users can view documents from their law firm" ON public.documents;

-- Create secure RLS policies for documents table
-- Block all anonymous access
CREATE POLICY "Block anonymous access to documents"
ON public.documents
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Users can only create documents if they are authenticated and uploading for themselves
CREATE POLICY "Users can create documents for their law firm"
ON public.documents
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = uploaded_by
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND law_firm_id IS NOT NULL
    AND created_at IS NOT NULL
  )
);

-- Users can only view documents from their law firm with proper validation
CREATE POLICY "Users can view documents from their law firm"
ON public.documents
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles p1
    WHERE p1.id = auth.uid() 
    AND p1.law_firm_id IS NOT NULL
    AND p1.created_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = documents.uploaded_by
      AND p2.law_firm_id = p1.law_firm_id
      AND p2.law_firm_id IS NOT NULL
    )
  )
);

-- Admin users can view all documents
CREATE POLICY "Admins can view all documents"
ON public.documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  )
);

-- Users can only update documents from their law firm with proper validation
CREATE POLICY "Users can update documents from their law firm"
ON public.documents
FOR UPDATE
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles p1
    WHERE p1.id = auth.uid() 
    AND p1.law_firm_id IS NOT NULL
    AND p1.created_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p2
      WHERE p2.id = documents.uploaded_by
      AND p2.law_firm_id = p1.law_firm_id
      AND p2.law_firm_id IS NOT NULL
    )
  )
);

-- Admin users can update all documents
CREATE POLICY "Admins can update all documents"
ON public.documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  )
);

-- Add delete policy for admins only (security best practice)
CREATE POLICY "Only admins can delete documents"
ON public.documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND created_at IS NOT NULL
  )
);

-- Create trigger to log document access for security monitoring
CREATE OR REPLACE FUNCTION public.log_document_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access to document data for security monitoring
  PERFORM public.log_sensitive_data_access(
    'documents',
    NEW.id,
    'document_access'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger for document access logging
CREATE TRIGGER log_document_access_trigger
  AFTER SELECT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_document_access();