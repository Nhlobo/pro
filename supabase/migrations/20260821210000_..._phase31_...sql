-- =====================================================================
-- EXTERNAL PORTAL MODULE — PHASE 31
-- Notification routing fix + explicit re-confirmation of notifications
-- RLS, requested after a report that internal staff were seeing "the
-- last logged-in attorney's" notifications in their bell.
--
-- AUDIT RESULT: the `notifications` table's own RLS was already
-- correct and is NOT changed by this migration —
--   "Users can view their own notifications": USING (auth.uid() = user_id)
--   "Users can update their own notifications": USING (auth.uid() = user_id)
-- Both are re-asserted below (idempotent DROP + CREATE) purely to
-- leave a clear, auditable record that this was checked, not because
-- anything needed fixing at the database layer. A user's auth.uid()
-- cannot read another user's notification row under this policy,
-- regardless of portal or role.
--
-- The one broader grant on this table, "System admins full access to
-- notifications" (USING (is_system_admin())), is a legitimate,
-- unrelated elevated capability for admin tooling (e.g. a future
-- notifications-management screen) — not a leak, and not something
-- the ordinary staff bell relies on or exercises: the corresponding
-- frontend hook (useStaffNotifications.tsx) always explicitly filters
-- by `user_id = <the current session's own id>` itself, regardless of
-- whether that session happens to be an admin, so it never surfaces
-- another user's notifications even though the broader admin grant
-- would technically permit a direct query to.
--
-- ACTUAL ROOT CAUSE of the reported symptom: not a database access
-- issue at all — it was two frontend problems, fixed in this same
-- change (see the corresponding .tsx files, not this migration):
--   1. One shared NotificationCenter.tsx component/hook served admin,
--      attorney, and expert layouts alike. Now split into two fully
--      separate implementations — useStaffNotifications.tsx /
--      StaffNotificationBell.tsx for admin, useNotifications.tsx /
--      NotificationCenter.tsx for attorney/expert portal only — so
--      there is no shared component, hook, in-memory state, or
--      realtime channel between a staff session and a portal session,
--      however they're navigated between in the same browser.
--   2. Both hooks now re-confirm identity fresh via
--      supabase.auth.getUser() at the moment of every fetch, rather
--      than trusting a potentially-stale `user` object already in
--      React context — and the staff hook additionally re-confirms
--      the fresh session's own role before showing anything, failing
--      closed (shows nothing) if that check doesn't pass.
--   3. Realtime channel names were a single shared, generic string
--      across every mounted instance of the old hook — now scoped per
--      user id (`staff-notifications-<uuid>` /
--      `portal-notifications-<uuid>`), removing any possibility of a
--      same-named channel from a fast account switch overlapping with
--      one that hasn't fully unsubscribed yet.
--
-- SEPARATELY: this migration also fixes the notification ROUTING bug
-- itself — "Asanda report is ready" opening the AOD/Agreements page
-- instead of Reports. That bug lived entirely in frontend routing
-- logic (NotificationCenter.tsx prioritized related_table over
-- category, so a report_ready notification — related_table =
-- 'documents', because the row genuinely lives in the documents table
-- — fell into the generic "documents → Agreements" branch). No
-- database change was needed for that either; see
-- src/lib/notificationRouting.ts, now the single shared, corrected
-- routing logic used by both bells and both notification pages.
-- =====================================================================

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view their own notifications" ON public.notifications IS
  'Phase 31: re-asserted, unchanged, after an audit prompted by a report of cross-user notification visibility. Confirmed correct — auth.uid() = user_id was always the only condition, and the actual cause of the reported symptom was frontend (a single shared bell component across staff and portal contexts, now split — see StaffNotificationBell.tsx / NotificationCenter.tsx), not this policy.';
