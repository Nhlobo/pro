-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 22
-- Per-individual-contact usage counts for the admin account-creation
-- picker.
--
-- WHY: external_portal_referring_attorneys_by_usage() (Phase 10) counts
-- every appointment for the WHOLE FIRM (a.referring_attorney_id =
-- ra.id), with no awareness of individual contacts, which didn't exist
-- yet at Phase 10. The admin UI shows this number next to the firm
-- name in Step 2 of account creation ("Shamulo Attorneys Inc. — 12
-- cases"), which is correct as a firm total, but is easy to misread as
-- "this account will see 12 cases" — and if the admin then scopes the
-- account to one INDIVIDUAL at that firm, the account will actually
-- only ever see that individual's subset of the 12, not all 12. There
-- was no way to see that subset count before choosing to create the
-- account, so the mismatch was only discoverable after the fact, at
-- login.
--
-- FIX: a companion per-contact usage RPC, plus updated frontend copy
-- (Phase 22 frontend change) that labels the firm number as an
-- explicit firm total and shows the individual's own count once a
-- contact is selected.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.external_portal_attorney_contacts_by_usage(p_referring_attorney_id uuid)
RETURNS TABLE (
  id UUID,
  referring_attorney_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN,
  usage_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    rac.id,
    rac.referring_attorney_id,
    rac.full_name,
    rac.email,
    rac.phone,
    rac.is_active,
    count(a.id) AS usage_count
  FROM public.referring_attorney_contacts rac
  LEFT JOIN public.appointments a
    ON a.assigned_attorney_contact_id = rac.id
    AND a.deleted_at IS NULL
    AND a.case_status IS DISTINCT FROM 'cancelled'
  WHERE rac.referring_attorney_id = p_referring_attorney_id
    AND rac.is_active = true
  GROUP BY rac.id, rac.referring_attorney_id, rac.full_name, rac.email, rac.phone, rac.is_active
  ORDER BY usage_count DESC, rac.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.external_portal_attorney_contacts_by_usage(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.external_portal_attorney_contacts_by_usage(uuid) FROM anon;

COMMENT ON FUNCTION public.external_portal_attorney_contacts_by_usage(uuid) IS
  'Phase 22: per-individual-contact case count at a given firm, same "usage" definition (non-deleted, non-cancelled appointments) as the Phase 10 firm-level and expert-level usage RPCs. Lets the admin UI show what an INDIVIDUAL-scoped account will actually see, distinct from the firm total.';
