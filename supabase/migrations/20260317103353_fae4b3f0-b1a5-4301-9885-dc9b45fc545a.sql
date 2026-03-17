-- Add approval and access control columns to documents table
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS is_visible_to_attorney boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_visible_to_expert boolean NOT NULL DEFAULT true;

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_documents_approval_status ON public.documents(approval_status);
CREATE INDEX IF NOT EXISTS idx_documents_access_level ON public.documents(access_level);
CREATE INDEX IF NOT EXISTS idx_documents_claimant_id ON public.documents(claimant_id);

-- Update RLS: employees can view/manage all documents  
CREATE POLICY "Employees can view all documents"
  ON public.documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.created_at IS NOT NULL
    )
  );

CREATE POLICY "Employees can insert documents"
  ON public.documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.created_at IS NOT NULL
    )
  );

CREATE POLICY "Employees can update documents"
  ON public.documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'employee'
      AND profiles.created_at IS NOT NULL
    )
  );