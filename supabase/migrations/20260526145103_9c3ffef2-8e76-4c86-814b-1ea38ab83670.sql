
-- 1) Remove email_queue from realtime publication to stop broadcasting sensitive email payloads
ALTER PUBLICATION supabase_realtime DROP TABLE public.email_queue;

-- 2) Make dashboard_completed_reports respect caller RLS
ALTER VIEW public.dashboard_completed_reports SET (security_invoker = true);

-- 3) Tighten short-term-agreements storage upload policy to enforce path-prefix
DROP POLICY IF EXISTS "Users can upload agreement documents for their law firm" ON storage.objects;

CREATE POLICY "Users can upload agreement documents for their law firm"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'short-term-agreements'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.referring_attorney_id IS NOT NULL
      AND (storage.foldername(objects.name))[1] = p.referring_attorney_id::text
  )
);

-- 4) Restrict email_queue inserts to admin/employee staff to prevent stored-XSS injection by external users
DROP POLICY IF EXISTS "Authenticated users can insert email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Users can insert email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Anyone authenticated can insert email queue" ON public.email_queue;

CREATE POLICY "Staff can insert email queue"
ON public.email_queue
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_employee());
