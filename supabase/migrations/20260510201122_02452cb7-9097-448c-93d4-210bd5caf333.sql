
-- 1. Lock down profile self-update so users cannot escalate role/user_type
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND user_type IS NOT DISTINCT FROM (SELECT user_type FROM public.profiles WHERE id = auth.uid())
  AND referring_attorney_id IS NOT DISTINCT FROM (SELECT referring_attorney_id FROM public.profiles WHERE id = auth.uid())
);

-- Trigger-based safety net to forbid privileged column changes by non-admins
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_system_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.referring_attorney_id IS DISTINCT FROM OLD.referring_attorney_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2. Storage: case-management-reports DELETE must check ownership / staff
DROP POLICY IF EXISTS "Users can delete their uploaded case reports" ON storage.objects;

CREATE POLICY "Users can delete their uploaded case reports"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'case-management-reports'
  AND ((owner = auth.uid()) OR public.is_admin_or_employee())
);

-- 3. Storage: aod-documents INSERT must verify the user belongs to the law firm
DROP POLICY IF EXISTS "Users can upload AOD documents for their law firm" ON storage.objects;

CREATE POLICY "Users can upload AOD documents for their law firm"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'aod-documents'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_system_admin()
    OR public.is_admin_or_employee()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.referring_attorney_id IS NOT NULL
        AND (storage.foldername(name))[1] = p.referring_attorney_id::text
    )
  )
);

-- 4. Storage: short-term-agreements DELETE must scope to the user's law firm
DROP POLICY IF EXISTS "Users can delete agreement documents from their law firm" ON storage.objects;

CREATE POLICY "Users can delete agreement documents from their law firm"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'short-term-agreements'
  AND (
    public.is_system_admin()
    OR EXISTS (
      SELECT 1
      FROM public.short_term_agreements sta
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE sta.document_url = storage.objects.name
        AND sta.referring_attorney_id = p.referring_attorney_id
        AND p.referring_attorney_id IS NOT NULL
    )
  )
);

-- 5. short_term_agreements: allow referring attorney users to read their own
CREATE POLICY "Referring attorneys can view their agreements"
ON public.short_term_agreements
FOR SELECT
USING (
  referring_attorney_id IS NOT NULL
  AND referring_attorney_id = public.get_current_user_referring_attorney()
);

-- 6. attorney_access_codes: allow referring attorneys to view their codes
CREATE POLICY "Referring attorneys can view their access codes"
ON public.attorney_access_codes
FOR SELECT
USING (
  referring_attorney_id IS NOT NULL
  AND referring_attorney_id = public.get_current_user_referring_attorney()
);

-- 7. expert_access_codes: allow medical experts to view their own access codes
CREATE POLICY "Experts can view their own access codes"
ON public.expert_access_codes
FOR SELECT
USING (
  expert_id IS NOT NULL
  AND expert_id = public.get_current_user_expert_id()
);
