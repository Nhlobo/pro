## Sales Performance Reporting System

Automated weekly + monthly performance reports for sales consultants and non-consultants, with strike early-warning, history, admin preview, and personalised email delivery.

### What gets built

**1. Database (migration)**
- `sales_performance_reports` table — stores every issued report
  - Fields: `consultant_id`, `user_id`, `consultant_name`, `email`, `period_type` ('weekly' | 'monthly'), `period_start`, `period_end`, `deals_closed`, `target`, `target_met` (bool), `strike_risk_level` ('none' | 'low' | 'medium' | 'high'), `auto_comment` (text), `congratulations` (text, nullable), `report_html` (text), `sent_at`, `delivery_status`
  - RLS: admins/managers can read all; consultants read their own
- Index on `(consultant_id, period_type, period_start)`

**2. RPC: `generate_sales_performance_report(_consultant_id, _period_type, _period_start, _period_end)`**
- Returns JSON with: deals count, target, target_met, strike risk, auto comment, congrats, and a structured payload the edge function uses to render HTML
- Strike risk derived from current strike count + pace vs target:
  - high = already at 2 strikes OR <30% of target with <3 days left
  - medium = 1 strike OR <50% pace
  - low = on track but behind
  - none = on/above target

**3. Edge function: `send-sales-performance-report`**
- Inputs: `{ period_type: 'weekly' | 'monthly', preview?: boolean, consultant_id?: string }`
- For scheduled runs: iterates all active sales/non-sales consultants from `sales_consultants` joined with `profiles` for email
- Builds professional branded HTML report (Medico-Legal Pro theme, white bg, semantic tokens-aligned inline styles) addressed directly to the consultant ("Hi {firstName}, here is your week…")
- Sections: Period summary, Deals vs Target, Strike status + early warning, Auto-generated comment (expectations for next week/month), Congratulations block (when target met / top performer), Performance trend (prev period comparison)
- Sends via existing `sendEmail` shared helper (matches `send-performance-warning` pattern)
- Writes a row into `sales_performance_reports` for history
- If `preview: true` returns rendered HTML without sending
- If `consultant_id` provided: only that consultant (admin preview/test)
- Monthly report consolidates the 4 weekly reports from that month (pulled from `sales_performance_reports`)

**4. Cron schedules (pg_cron + pg_net)**
- Weekly: every Monday 09:00 SAST → `send-sales-performance-report` with `period_type: 'weekly'` for previous Mon–Sun
- Monthly: last day of month 18:00 SAST → `period_type: 'monthly'` consolidating that month's weeklies

**5. Admin UI — Performance Reports tab**
- New page `src/pages/admin/SalesPerformanceReports.tsx` (linked from Sales Admin)
- Filter by consultant, period type, date range
- Table of history with status badges (target met ✓, strike risk colour)
- "Preview" dialog renders the exact email HTML in an iframe
- "Resend" + "Generate now" buttons (admin only)

### Technical details

- Email "From": `Medico-Legal Pro <noreply@kamedico-legal.co.za>` (matches existing functions)
- Target resolution: 7 for sales consultants, 2 for non-sales consultants (matches `send-performance-warning` rule)
- Recipient: `profiles.email` for the matched `user_id`; fallback to `auth.admin.getUserById`
- Manager CC: pulled from system setting if available, else skip
- All times SAST (UTC+2), en-ZA formatting
- Strike data joined from existing `sales_strikes` table (assumed; will verify in migration)
- History retention: indefinite (lightweight rows)

### Files

- `supabase/migrations/<ts>_sales_performance_reports.sql` — table + RLS + RPC + cron jobs
- `supabase/functions/send-sales-performance-report/index.ts` — new edge function
- `src/pages/admin/SalesPerformanceReports.tsx` — admin UI
- `src/App.tsx` — route registration
- `src/pages/SalesAdmin.tsx` — add nav link
