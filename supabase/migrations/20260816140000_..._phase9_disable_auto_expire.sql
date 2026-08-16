-- =====================================================================
-- External Portal Module — Phase 9: stop auto-expiring accounts when
-- their linked cases close
-- =====================================================================
--
-- external_portal_auto_expire_stale_accounts() (Phase 1, scheduled
-- hourly since Phase 5) fully revokes an attorney/expert's account —
-- blocks login entirely, not just hides old cases — the moment none
-- of their linked cases is still 'scheduled'. That directly conflicts
-- with wanting attorneys/experts to keep seeing their case *history*
-- once their active cases are done: this product decision is that
-- someone who's had a case here should keep access to it, closed or
-- not, not lose their login the moment nothing is left open.
--
-- The function itself is left in place (harmless while the setting
-- below is off, and available again with a single UPDATE if that
-- decision ever changes) — only the setting and its default change
-- here. Anyone it already wrongly expired is restored to Active, but
-- only accounts this specific mechanism expired (expired_reason
-- matches exactly what the function writes) — an account an admin
-- expired by hand for some other reason is left untouched.

UPDATE public.external_portal_settings
SET auto_expire_on_all_cases_closed = false
WHERE id = 1;

ALTER TABLE public.external_portal_settings
  ALTER COLUMN auto_expire_on_all_cases_closed SET DEFAULT false;

UPDATE public.external_portal_accounts
SET status = 'active', expired_at = NULL, expired_reason = NULL
WHERE status = 'expired'
  AND expired_reason = 'All linked cases closed';
