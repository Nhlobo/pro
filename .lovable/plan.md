## Activity Time Tracking + Personal Activity Reports

Extend the existing Sales Performance Reporting system so every logged-in user (sales consultants AND non-sales staff) gets a clean weekly + monthly email showing **where they spent their time** in the system, with their top activities ranked. Sales consultants get this merged into their existing performance report; everyone else gets a standalone "Your Activity" report.

---

### 1. Time tracking (frontend)

A lightweight `useActivityTracker` hook mounted once in `App.tsx`:
- Listens for route changes (`useLocation`) and user interaction (mousemove / keydown / click) to detect "active" vs idle.
- Buffers heartbeats locally and flushes every 60s (and on `visibilitychange`/`beforeunload`) to a new `log_activity_time` RPC.
- An activity name is derived from the route via a small `activityLabels.ts` map (e.g. `/admin/aod-payment-tracking` → "AOD Payment Tracking", `/expert-portal/...` → "Expert Portal"). Unknown routes fall back to a humanised slug.
- Idle threshold: 90s without interaction stops accumulating until next interaction. Tab hidden = paused.

This keeps tracking smart (no inflated time from idle tabs) and simple (one hook, one RPC).

### 2. Database (migration)

**Table `user_activity_time`** — append-only seconds-per-activity-per-day rows:
- `user_id`, `activity_key` (e.g. `aod-payment-tracking`), `activity_label`, `day` (date), `seconds_spent` (int), `last_updated_at`.
- Unique index on `(user_id, activity_key, day)` so the RPC upserts (adds seconds) instead of inserting duplicates.
- RLS: users read their own rows; admins/managers read all; service role full.

**RPC `log_activity_time(_activity_key, _activity_label, _seconds)`**
- Upserts into `user_activity_time` for `auth.uid()` + `current_date` (SAST), incrementing `seconds_spent`. SECURITY DEFINER.

**RPC `get_user_activity_summary(_user_id, _start, _end)`**
- Returns ranked rows: `activity_label`, `total_seconds`, `pct_of_total`, plus overall totals (total seconds, active days, top activity). Used by the edge function and admin preview.

### 3. Edge function — extend existing `send-sales-performance-report`

- For each recipient, call `get_user_activity_summary` for the period.
- Add a new **"Where you spent your time"** section to the report HTML:
  - Top 5 activities with a clean horizontal bar (% of total) + formatted duration (`2h 14m`).
  - Headline stat: total active hours + most-used activity ("Most of your time went to *Report Management* — 8h 42m, 41% of your week").
  - Smart auto-comment: if 1 activity > 60% → "Heavy focus on X"; if top activity changed from previous period → "Shift from X → Y"; if total active time dropped >30% → gentle nudge.
- Expand the recipient pool: today the function iterates `sales_consultants`. New behaviour — also iterate `profiles` for all active users whose `user_id` has any activity in the period and who are **not** already covered as sales consultants. Non-sales users receive a slimmer report (no deals/strikes/targets) — just the activity section + a friendly greeting.
- Reuses existing `sendEmail` helper, queue, retry, and `sales_performance_reports` history row (new column `report_kind` = `sales` | `activity_only`).

### 4. Cron — unchanged schedules, broader audience

Existing Monday 09:00 SAST + month-end 18:00 SAST cron jobs already call the function. No new schedule needed; the function itself now covers all users.

### 5. Admin UI — extend `SalesPerformanceReports.tsx`

- Add filter chip: **Report kind** (All / Sales / Activity-only).
- Preview dialog already renders HTML — works automatically for the new section.
- New small "Top activities" column showing the user's #1 activity for the period.

### 6. Privacy & POPIA

- Activity tracking is per-user only, no claimant/case content captured — just route + duration. Logged into existing `audit_logs` once at enablement.
- Users can see their own report; only admins/managers see others (matches existing reporting RLS).

---

### Files

- `supabase/migrations/<ts>_user_activity_time.sql` — table, indexes, RLS, GRANTs, two RPCs, adds `report_kind` column to `sales_performance_reports`.
- `src/hooks/useActivityTracker.tsx` — new hook.
- `src/config/activityLabels.ts` — route → friendly label map.
- `src/App.tsx` — mount the hook inside the authenticated layout.
- `supabase/functions/send-sales-performance-report/index.ts` — add activity section, broaden recipients, write `report_kind`.
- `src/lib/salesPerformanceEmailTemplate.ts` — add activity block renderer.
- `src/pages/admin/SalesPerformanceReports.tsx` — kind filter + top-activity column.

### Notes

- Keeps the feature **simple**: one hook, one table, one RPC for writes, one for reads, one edge function extended.
- Keeps it **smart**: idle detection, tab-hidden pause, route-based labels, auto comments based on focus/shift/drop.
- Backwards compatible — existing sales weekly/monthly reports keep working; non-sales users start receiving activity-only reports from the next scheduled run.
