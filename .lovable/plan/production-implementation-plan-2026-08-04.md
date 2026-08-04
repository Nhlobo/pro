# Production Implementation Plan

You skipped the clarifying questions, so this plan states the defaults I chose. Correct any of them and I'll adjust before building.

## What the audit found

The good news: most of this is already scaffolded in the codebase. The gaps are narrower than the brief suggests.

| Area | Current state |
| --- | --- |
| Expert Network / Finance pages | Compile clean, no type errors, no missing imports. Nothing is structurally "gone" — so "restore" becomes a targeted defect hunt, not a rebuild. |
| Sage One | Edge function, retry logic, dedupe index and queue migration all exist. **The queue table was never applied to this remixed database**, so the trigger and the whole flow are dead. Appointment creation swallows the error, which is why nothing visibly breaks. |
| Attorney access codes | `attorney_access_codes` table exists and a `validate-access-code` function works. Expiry enforcement and link generation UI need verifying/finishing. |
| Weekly/monthly reporting | Sales performance report is scheduled Mondays 07:00. The **operational** report function exists but is **not scheduled at all**, and the "monthly" sales job is mis-scheduled as a daily 16:00 job. |

## Chosen defaults

- **Sage product**: provider-agnostic adapter. The existing API-URL + API-key path stays live; an OAuth2 (Sage Business Cloud) strategy slots in behind the same interface later without touching callers.
- **Attorney accounts**: grandfather existing logins. The role is removed from user creation and signup so no new attorney accounts appear; existing ones keep working until you say otherwise. Secure expiring links become the primary access path. This is the only non-destructive reading of the request.
- **Report recipients**: individual performance report to each sales consultant; weekly operational report to admins, directors and employees; monthly operational report to admins and directors.

## Phase 1 — Stabilise Expert Network and Finance

1. Walk every tab of both modules against its data source, checking for: queries filtered on columns that no longer exist, empty-state masking a failed fetch, totals that ignore VAT or the R0 clamp, and permission checks that hide working features.
2. Fix defects found. No refactors, no redesigns, no schema changes.
3. Confirm fee/payment changes still propagate through the shared sync utilities added previously.

Nothing in Phase 2 starts until this is clean.

## Phase 2.1 — Sage One tax invoices

1. Apply the existing `sageone_invoice_queue` migration to this database, adding the `GRANT` statements it is missing.
2. Keep the `AFTER INSERT` trigger on `appointments` as the enqueue point — the appointment stays the source of truth, and enqueueing can never fail the booking.
3. Add a feature flag so the integration is off until Sage credentials are set; with the flag off, rows queue harmlessly and nothing calls out.
4. Add an hourly cron to drain the queue, so a Sage outage self-heals without staff intervention.
5. Add a **Sage Invoices** panel in Finance showing queued / failed / synced rows with a manual retry button.

Duplicate protection is already handled by the partial unique index on `appointment_id`.

## Phase 2.2 — Secure referring-attorney links

1. Enforce `expires_at` server-side in `validate-access-code` — an expired or revoked code returns 403 with no data.
2. Generate cryptographically random codes with a configurable expiry (default 14 days) and a revoke action.
3. Add link generation and revocation to the attorney CRM screen, showing issued, expiry and last-used.
4. Remove `referring_attorney` from the role picker in user creation. Existing accounts untouched.

## Phase 2.3 — Automated reporting

1. Schedule the weekly operational report Mondays 07:15 SAST.
2. Schedule the monthly operational report on the 1st at 07:30 SAST.
3. Fix the mis-scheduled monthly sales job so it runs monthly, not daily.
4. Every job wrapped so a delivery failure logs and exits rather than retrying in a loop.

## Phase 3 — Verification

- Full typecheck and the existing unit/integration suites.
- Manual walk of Expert Network, Finance, Appointments, Attorney CRM and the admin dashboard at mobile, tablet and desktop widths.
- Confirm appointment creation still succeeds with Sage deliberately unreachable.

## Technical notes

- Two new migrations only: the Sage queue (plus grants and cron) and the attorney access-code expiry/revocation columns. No existing table is altered destructively; no existing function is dropped.
- New edge-function work is confined to `sageone-processor` and `validate-access-code`.
- The Sage adapter lives in `supabase/functions/_shared/` so a future OAuth strategy is a single new file.
- All new behaviour is additive and flag-guarded; with every flag off the system behaves exactly as it does today.

## Scope note

This is three substantial features plus a defect hunt. I'll deliver them in the phase order above and report after each phase rather than at the very end, so you can stop or redirect me between phases.
