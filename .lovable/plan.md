## Goal

Add a unified Proof-of-Payment (POP) attachment + payment reference workflow across the three "attorney request" surfaces (Appointment Requests, AOD Payments, Expert Payments), with a SageOne placeholder field and a configurable required/optional toggle (default: optional).

## Database (single migration)

Create a new generic table `public.payment_pop_attachments`:

- `id uuid pk`
- `record_type text` check in (`appointment_request`, `aod_payment`, `expert_payment`)
- `record_id uuid not null` (loose FK — different parent tables)
- `payment_reference text not null` (indexed)
- `sageone_transaction_id text` (nullable, indexed, admin-editable)
- `file_path text not null` (Supabase Storage path)
- `file_name text`, `file_size_bytes int`, `mime_type text`
- `uploaded_by uuid` (profiles.id, ON DELETE SET NULL)
- `uploaded_at timestamptz default now()`
- `notes text`
- standard `created_at`, `updated_at` + trigger

Add columns to existing tables:
- `appointment_requests.payment_reference text`, `pop_attachment_id uuid`, `sageone_transaction_id text`
- `aod_payments.payment_reference text` (if not present), `pop_attachment_id uuid`, `sageone_transaction_id text`
- `expert_payments.payment_reference text`, `pop_attachment_id uuid`, `sageone_transaction_id text`

Auto-generate reference via trigger when null: `PAY-YYYYMM-<6-char-suffix>` (user can override on insert).

RLS:
- authenticated users can SELECT/INSERT POPs they uploaded or which belong to records they can already see (via existing policies on the parent tables — checked through `has_role('admin')` OR matching attorney via `user_attorney_links`).
- only admins can edit `sageone_transaction_id`.
- service_role full access.

Audit trail: insert into `audit_logs` on POP upload/delete (admin visibility per POPIA memory).

## Storage

New private bucket `payment-pops`. RLS on `storage.objects`:
- authenticated can INSERT into their own scoped path `{record_type}/{record_id}/...`
- SELECT allowed for admins and for the uploading user; attorneys see only POPs on records they can access.
- 10 MB cap enforced client-side; allowed MIME: `application/pdf`, `image/jpeg`, `image/png`.

## System Setting

Add row to `system_settings`: key `pop_required_on_submission` = `false` (default optional). Surfaced in `AdminSystemControl` as a toggle.

## Edge functions

- `upload-pop-attachment` (verify_jwt=true): receives base64 file + metadata, validates mime/size, writes to storage, inserts `payment_pop_attachments` row, updates parent record's `pop_attachment_id` + `payment_reference`, writes audit log. Returns row id + signed-url helper.
- `get-pop-signed-url`: returns a 5-minute signed download URL after permission check.

(No SageOne integration logic — placeholder column only.)

## Frontend

New shared component `src/components/pop/PopAttachmentField.tsx`:
- "Attach POP" button → file picker (PDF/JPG/PNG, 10 MB)
- Inline status badge: "POP Uploaded" (green) / "Missing POP" (amber) / "Not required" (muted) based on system setting
- View + Download links (signed URL)
- Payment reference input (auto-suggested, editable)
- Admin-only SageOne Transaction ID field

New hook `src/hooks/usePopAttachment.tsx` for upload/fetch/delete.

Wire `PopAttachmentField` into:
- `src/pages/AppointmentRequest.tsx` (submission form) + show status column in `AppointmentRequestDashboard.tsx`
- AOD payment recording UI in `AODManagement.tsx`
- Expert payment recording UI in `ExpertCreditControl.tsx` (already has POP concept per memory — extend to use the new unified table; keep backward compat by falling back to existing `expert_pop_attachments` memory pattern via dual read)

Submission validation:
- Read `pop_required_on_submission` from `useSystemSettings`. If `true` and no POP attached → block submit with toast. If `false` → allow, show "Missing POP" badge.

## Out of scope

- Actual SageOne API calls (placeholder column only)
- Migrating historical POPs already stored in `aod_documents` / expert POP fields (those remain readable; new uploads use unified table)
- Auto-reconciliation logic

## Technical details

- Loose `record_id` (no FK) keeps one table serving three parents; integrity enforced at app layer + RLS.
- Generated reference uses `to_char(now(),'YYYYMM') || '-' || substr(md5(random()::text),1,6)` in BEFORE INSERT trigger only when null.
- Signed URLs (not public bucket) preserve POPIA compliance.
- Realtime not enabled on the new table (no live dashboard need).
