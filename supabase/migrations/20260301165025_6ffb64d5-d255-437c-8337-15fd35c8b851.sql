
-- Allow sales_consultant to view all referring attorneys
CREATE POLICY "Sales consultants can view all referring attorneys"
ON public.referring_attorneys
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'sales_consultant'));

-- Allow sales_consultant to insert referring attorneys
CREATE POLICY "Sales consultants can create referring attorneys"
ON public.referring_attorneys
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'sales_consultant'));

-- Allow sales_consultant to update referring attorneys
CREATE POLICY "Sales consultants can update referring attorneys"
ON public.referring_attorneys
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'sales_consultant'))
WITH CHECK (has_role(auth.uid(), 'sales_consultant'));

-- Allow sales_consultant full access to claimants
CREATE POLICY "Sales consultants can view all claimants"
ON public.claimants
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'sales_consultant'));

CREATE POLICY "Sales consultants can create claimants"
ON public.claimants
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'sales_consultant'));

CREATE POLICY "Sales consultants can update claimants"
ON public.claimants
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'sales_consultant'))
WITH CHECK (has_role(auth.uid(), 'sales_consultant'));

-- Allow sales_consultant full access to attorney_pitchlog
CREATE POLICY "Sales consultants can manage pitchlog"
ON public.attorney_pitchlog
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'sales_consultant'))
WITH CHECK (has_role(auth.uid(), 'sales_consultant'));
