-- =====================================================================
-- External Portal Module — Phase 8: backfill profiles left unlinked
-- by the account_status bug in bridgeToSupabaseAuth
-- =====================================================================
--
-- bridgeToSupabaseAuth's profiles upsert (external-portal-auth/
-- index.ts) has included an account_status field since this module's
-- very first migration. profiles has no such column — it has
-- is_active; account_status belongs to external_portal_accounts, not
-- this table — so that upsert has failed on *every* external-portal
-- login since the module existed, and the failure was never checked,
-- so login proceeded anyway with whatever blank profile
-- handle_new_user() had already created: role='user',
-- referring_attorney_id/expert_id both NULL. Since RLS on
-- appointments/expert_reports/etc. is keyed off exactly those two
-- columns, this means no external-portal attorney or expert has ever
-- been able to see any of their case data — active or closed —
-- through this bug's entire lifetime. This is independent of, and in
-- addition to, the role/user_type CHECK-constraint failure Phase 6
-- already fixed: that fixed a different failure on the same upsert
-- call; this field failed it for a separate reason and kept failing
-- straight through Phase 6.
--
-- The code is fixed separately (account_status removed from the
-- upsert; its error is now checked and hard-stops the login instead
-- of silently continuing). This migration is the one-time backfill
-- for every profile the bug already produced before that fix shipped:
-- for each auth user with a 'referring_attorney' or 'medical_expert'
-- row in user_roles — that table's upsert is a separate call and was
-- never affected by this bug, so it's the reliable record of who's
-- really an external-portal user and which role they hold — re-derive
-- role / user_type / referring_attorney_id / expert_id / is_active
-- from their matching external_portal_accounts row and correct them.
--
-- Matched on email + portal_type rather than a stored auth-user
-- reference, because external_portal_accounts has no such column
-- (bridgeToSupabaseAuth never wrote one back — a separate, lower-
-- priority gap: it only makes the admin "signed in?" badge unreliable,
-- not case visibility, so it's left alone here).

-- Referring attorneys
UPDATE public.profiles p
SET
  role = 'referring_attorney',
  user_type = 'external_portal',
  referring_attorney_id = epa.referring_attorney_id,
  is_active = true
FROM public.user_roles ur, public.external_portal_accounts epa
WHERE ur.user_id = p.id
  AND ur.role = 'referring_attorney'
  AND epa.portal_type = 'attorney'
  AND epa.deleted_at IS NULL
  AND lower(epa.email) = lower(p.email)
  AND p.is_external_portal_user = true
  AND p.referring_attorney_id IS DISTINCT FROM epa.referring_attorney_id;

-- Medical experts
UPDATE public.profiles p
SET
  role = 'medical_expert',
  user_type = 'external_portal',
  expert_id = epa.medical_expert_id,
  is_active = true
FROM public.user_roles ur, public.external_portal_accounts epa
WHERE ur.user_id = p.id
  AND ur.role = 'medical_expert'
  AND epa.portal_type = 'expert'
  AND epa.deleted_at IS NULL
  AND lower(epa.email) = lower(p.email)
  AND p.is_external_portal_user = true
  AND p.expert_id IS DISTINCT FROM epa.medical_expert_id;
