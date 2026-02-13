-- Junction table: link users to multiple referring attorneys
CREATE TABLE public.user_attorney_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referring_attorney_id uuid NOT NULL REFERENCES public.referring_attorneys(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, referring_attorney_id)
);

-- Enable RLS
ALTER TABLE public.user_attorney_links ENABLE ROW LEVEL SECURITY;

-- Admin/employee can manage all links
CREATE POLICY "Admins can manage attorney links"
ON public.user_attorney_links
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'employee')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'employee')
  )
);

-- Users can view their own links
CREATE POLICY "Users can view own attorney links"
ON public.user_attorney_links
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
