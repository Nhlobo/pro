
-- 1. Backfill user_roles for existing admins so tightening is_system_admin doesn't lock anyone out
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE (p.role = 'admin' OR p.user_type = 'admin')
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','employee'))
ON CONFLICT DO NOTHING;

-- 2. Harden is_system_admin: only consult user_roles, never the mutable profiles fields
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin','employee')
  );
$$;

-- 3. notifications: prevent any authenticated user from creating notifications for other users
DROP POLICY IF EXISTS "Allow notification creation" ON public.notifications;
CREATE POLICY "Users can create their own notifications, staff can create any"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin_or_employee());

-- 4. email_queue: remove the overly permissive insert policy; staff-only insert remains
DROP POLICY IF EXISTS "Authenticated can insert email queue" ON public.email_queue;

-- 5. AOD storage: align UPDATE/DELETE with INSERT folder-isolation rule
DROP POLICY IF EXISTS "Users can update AOD documents from their law firm" ON storage.objects;
CREATE POLICY "Users can update AOD documents from their law firm"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'aod-documents'
  AND (
    public.is_system_admin()
    OR public.is_admin_or_employee()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.referring_attorney_id IS NOT NULL
        AND (storage.foldername(objects.name))[1] = (p.referring_attorney_id)::text
    )
  )
)
WITH CHECK (
  bucket_id = 'aod-documents'
  AND (
    public.is_system_admin()
    OR public.is_admin_or_employee()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.referring_attorney_id IS NOT NULL
        AND (storage.foldername(objects.name))[1] = (p.referring_attorney_id)::text
    )
  )
);

DROP POLICY IF EXISTS "Users can delete AOD documents from their law firm" ON storage.objects;
CREATE POLICY "Users can delete AOD documents from their law firm"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'aod-documents'
  AND (
    public.is_system_admin()
    OR public.is_admin_or_employee()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.referring_attorney_id IS NOT NULL
        AND (storage.foldername(objects.name))[1] = (p.referring_attorney_id)::text
    )
  )
);
