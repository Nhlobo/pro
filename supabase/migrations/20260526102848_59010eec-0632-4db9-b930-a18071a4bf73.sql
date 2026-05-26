
ALTER TABLE public.medical_experts
  ADD COLUMN IF NOT EXISTS qualifications_document_url text,
  ADD COLUMN IF NOT EXISTS hpcsa_document_url text;

DO $$
DECLARE
  admin_uid uuid;
  exp record;
BEGIN
  SELECT user_id INTO admin_uid FROM public.user_roles WHERE role = 'admin' ORDER BY created_at NULLS LAST LIMIT 1;
  IF admin_uid IS NULL THEN
    RAISE NOTICE 'No admin user available for backfill, skipping';
    RETURN;
  END IF;

  FOR exp IN
    SELECT id, first_name, last_name, cv_document_url, qualifications_document_url, hpcsa_document_url
    FROM public.medical_experts
  LOOP
    IF exp.cv_document_url IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.documents WHERE expert_id = exp.id AND document_type = 'Expert CV'
    ) THEN
      INSERT INTO public.documents (
        document_type, file_name, file_path, expert_id, uploaded_by,
        approval_status, access_level, is_visible_to_attorney, is_visible_to_expert, notes
      ) VALUES (
        'Expert CV',
        'CV - ' || coalesce(exp.first_name,'') || ' ' || coalesce(exp.last_name,''),
        exp.cv_document_url, exp.id, admin_uid,
        'approved', 'internal', false, true,
        'Backfilled from expert profile'
      );
    END IF;

    IF exp.qualifications_document_url IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.documents WHERE expert_id = exp.id AND document_type = 'Expert Qualifications'
    ) THEN
      INSERT INTO public.documents (
        document_type, file_name, file_path, expert_id, uploaded_by,
        approval_status, access_level, is_visible_to_attorney, is_visible_to_expert, notes
      ) VALUES (
        'Expert Qualifications',
        'Qualifications - ' || coalesce(exp.first_name,'') || ' ' || coalesce(exp.last_name,''),
        exp.qualifications_document_url, exp.id, admin_uid,
        'approved', 'internal', false, true,
        'Backfilled from expert profile'
      );
    END IF;

    IF exp.hpcsa_document_url IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.documents WHERE expert_id = exp.id AND document_type = 'Expert HPCSA Certificate'
    ) THEN
      INSERT INTO public.documents (
        document_type, file_name, file_path, expert_id, uploaded_by,
        approval_status, access_level, is_visible_to_attorney, is_visible_to_expert, notes
      ) VALUES (
        'Expert HPCSA Certificate',
        'HPCSA - ' || coalesce(exp.first_name,'') || ' ' || coalesce(exp.last_name,''),
        exp.hpcsa_document_url, exp.id, admin_uid,
        'approved', 'internal', false, true,
        'Backfilled from expert profile'
      );
    END IF;
  END LOOP;
END $$;
