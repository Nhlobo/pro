-- Litigation Service Requests — staff ownership + cancellation reason.
--
-- Verified live before writing this: the previous pass's notification/
-- audit/storage plumbing (response_document_* columns, the
-- litigation-service-documents bucket, audit_writes_litigation_service_requests,
-- on_new_litigation_request_notify, notify-litigation-request-status-change,
-- submit-litigation-service-request) all already exist and are wired
-- correctly — nothing there needed touching.
--
-- What was still missing, on AdminLitigationRequests.tsx itself:
--  - No way to record WHO on staff owns a given request -> assigned_to /
--    assigned_at. The assignee is notified via public.notifications
--    (client-side insert from the admin page — RLS already allows any
--    admin/employee to insert a notification for another user).
--  - Cancelling a request just flipped status with no explanation, even
--    though the attorney gets emailed the change -> cancellation_reason,
--    required by the UI whenever staff cancel a request.

ALTER TABLE public.litigation_service_requests
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE INDEX IF NOT EXISTS idx_litigation_service_requests_assigned_to
  ON public.litigation_service_requests (assigned_to);

-- No RLS changes needed: the existing "Admins and employees can manage
-- all litigation requests" ALL policy already covers reading/writing
-- these new columns for staff, and audit_write_event() (the trigger
-- backing audit_writes_litigation_service_requests) diffs to_jsonb(NEW)
-- generically, so new columns are picked up automatically.
--
-- Not synced to external_portal_litigation_requests on purpose:
-- assigned_to/assigned_at/cancellation_reason are internal staff fields,
-- not something the external attorney portal mirror needs to expose.
