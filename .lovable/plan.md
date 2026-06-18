
# Authentication Module Upgrade

This plan upgrades only the auth surface. RLS, the 8 existing roles, the `has_role` RPC, dashboards, business workflows, and edge-function authorization remain untouched. All existing users keep their accounts; their next login routes through a one-time Security Setup wizard.

## Decisions (from your answers)

- **2FA**: Email OTP for internal staff (admin, employee, sales_consultant, finance, director, user). Attorney/Expert portals keep the existing TOTP `MFARequiredGuard` — unchanged.
- **Single session**: On successful login, call `signOut({scope:'global'})` on the prior session first, then sign in fresh. Other devices lose refresh ability within ~1 hr.
- **Legacy detection**: New column `profiles.security_setup_completed_at`. NULL = legacy → wizard required.
- **PWA**: Manifest + icons only. No service worker.

## Database changes (one migration)

New columns on `public.profiles` (no RLS changes):
- `security_setup_completed_at timestamptz` — NULL marks a legacy user.
- `account_status text default 'active'` — values: `active`, `pending_activation`, `suspended`, `locked`.
- `locked_until timestamptz`
- `failed_login_count int default 0`
- `last_failed_login_at timestamptz`
- `current_session_id text` — last-known active session for single-session enforcement.
- `force_security_setup boolean default false` — admin can re-trigger wizard.

New tables (with GRANTs + RLS — admin-only read, service-role write):
- `auth_otp_codes` — `user_id, code_hash, purpose ('login'|'reset'), expires_at, attempts, resend_count, consumed_at, created_at`. Unique partial index on `(user_id, purpose) where consumed_at is null` so a new code invalidates the prior.
- `account_activations` — `user_id, token_hash, expires_at, consumed_at, created_by, created_at`. 24-hour single-use links.
- `password_reset_tokens` — `user_id, token_hash, expires_at, consumed_at, created_at`. 1-hour single-use.
- `auth_audit_log` — `user_id, event_type, ip, user_agent, browser, os, device, metadata jsonb, created_at`. Append-only (revoke UPDATE/DELETE from all roles). Reusable RPC `log_auth_event(...)` invoked from edge functions only.

Event types logged: `login_success`, `login_failed`, `logout`, `forced_logout`, `password_created`, `password_changed`, `password_reset_requested`, `password_reset_completed`, `otp_sent`, `otp_verified`, `otp_failed`, `account_activated`, `account_locked`, `account_unlocked`, `account_suspended`, `account_reactivated`, `session_expired`, `security_setup_completed`, `activation_link_sent`.

## Edge functions (new — `verify_jwt = false`, in-code auth)

All use the existing dual-client pattern, structured logs + correlation IDs (matching the `auto-send-queued-email` style), and write to `auth_audit_log`.

1. `auth-login-start` — input: email + password. Verifies credentials via service-role `signInWithPassword` against a throwaway client, immediately signs that scratch session out, locks account after 3 fails, generates 6-digit OTP, hashes + stores it, invalidates prior OTP, enqueues email via `send-transactional-email` (`login-otp` template). Returns `challenge_id` only.
2. `auth-login-verify` — input: `challenge_id` + 6-digit code. Checks attempts ≤ 3, expiry ≤ 5 min. On success: revokes user's prior refresh tokens (single-session), mints a real session via `admin.generateLink({type:'magiclink'})` flow → returns access/refresh tokens to the client, stamps `current_session_id`, logs `login_success`.
3. `admin-create-user` — admin-only. Creates auth user with random unguessable password (never returned), inserts profile with `account_status='pending_activation'`, assigns role via existing `user_roles`, generates activation token, emails it (`account-activation` template). Replaces the parts of `create-user` that exposed temp passwords.
4. `admin-user-action` — admin-only dispatcher: `suspend`, `reactivate`, `unlock`, `disable`, `resend_activation`, `force_password_reset`, `force_security_setup`, `force_logout_all`. Every action audit-logged.
5. `auth-activate-account` — consumes activation token, marks profile `pending_activation` → wizard state, returns a short-lived signed handoff for the wizard.
6. `auth-forgot-password` — accepts email, always returns 200 (no enumeration), enqueues reset email if account exists & active.
7. `auth-reset-password` — consumes reset token, sets new password through service-role `admin.updateUserById`, then requires the user to do email-OTP via `auth-login-start` to actually log in.
8. `auth-session-heartbeat` (lightweight) — called by client every 60s; verifies `profiles.current_session_id` still matches client's session marker, otherwise returns 401 → client redirects to login. Backs the "logging in elsewhere kicks me out" rule without polling DB heavily.

## Email templates (transactional)

Scaffold transactional email infra if not present, then add templates:
- `login-otp` — 6-digit code, 5-minute validity notice.
- `account-activation` — branded activation link, 24-hour notice, who created the account.
- `password-reset` — 1-hour link.
- `account-locked-admin` — sent to admins on lockout.
- `forced-logout` (optional notice).

Branded with Medico-Legal Pro tokens (existing index.css palette + Scale icon mark).

## Frontend

New/updated files (UI + presentation only — no business logic changes):

- `src/pages/Auth.tsx` — replace single-form with three-step state machine: email+password → OTP → (handoff to wizard if `security_setup_completed_at` null or `force_security_setup`).
- `src/pages/auth/SecuritySetupWizard.tsx` — new. Steps: Welcome → Create Password (12+ chars, upper/lower/number/symbol with live checks via `zod`) → Email OTP → Done → route to dashboard. Cannot be skipped or back-buttoned past completion.
- `src/pages/auth/Activate.tsx` — new. Handles `/activate?token=...` deep link, exchanges token, drops user straight into the wizard.
- `src/pages/auth/ForgotPassword.tsx` and `src/pages/auth/ResetPassword.tsx` — new. Standard 2-page flow → forces OTP login after reset.
- `src/hooks/useAuth.tsx` — add wizard-required check (`security_setup_completed_at IS NULL` OR `force_security_setup`) and route guard.
- `src/components/ProtectedRoute.tsx` — extend with wizard-incomplete redirect to `/security-setup`.
- `src/hooks/useIdleTimeout.tsx` — new. 25-min warning toast, 30-min auto signOut. Reset on pointer/keydown/visibility.
- `src/hooks/useSessionHeartbeat.tsx` — new. Polls `auth-session-heartbeat` every 60s; on 401 → `signOut` + redirect.
- `src/hooks/useMaxSession.tsx` — new. Tracks session age; forces logout at 8 hr from `auth_audit_log.login_success`.
- `src/pages/UserManagement.tsx` — replace "create user with password" UI with "create user (sends activation email)" + buttons for suspend/reactivate/unlock/disable/resend activation/force reset/force wizard/force logout all. Surface a read-only "Authentication History" panel filtered to the selected user (login_success/failed, lockouts, OTP, password events).
- Remove/disable the public **Sign Up** tab on `Auth.tsx`.

## PWA (manifest-only)

- `public/manifest.webmanifest` — Medico-Legal Pro name, theme `#0F172A`, `display: "standalone"`, icons.
- Generate `icon-192.png`, `icon-512.png` (maskable) + `apple-touch-icon.png` from Scale mark.
- Add `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">` to `index.html`.
- No service worker. Existing Supabase `persistSession: true` already handles "valid session → dashboard, no session → login" on PWA launch.

## What this plan deliberately does NOT touch

- `user_roles` enum, `has_role`, RLS on any business table.
- Any dashboard route, admin module, attorney/expert portal page, or business edge function.
- TOTP `MFARequiredGuard` for attorney/expert portals — kept exactly as is.
- Existing email-queue, audit-trail (`audit_logs`), or notification systems — new `auth_audit_log` is additive.

## Migration safety for existing users

- All current users continue to authenticate with their existing password (still in `auth.users`).
- First login after deploy → password works → server forces OTP → server forces wizard (because `security_setup_completed_at IS NULL`) → user picks a new compliant password + verifies OTP → wizard timestamps the column → never asked again.
- No `auth.users` rows are deleted, recreated, or have IDs changed. No profile rows are deleted.

## Rollout order

1. Migration (columns + new tables + RPC + GRANTs).
2. Edge functions + email templates + deploy.
3. Frontend wizard, login flow, forgot/reset, idle/heartbeat/max-session hooks.
4. UserManagement admin UI rewrite.
5. PWA manifest + icons.
6. Manual smoke test of: legacy login → wizard, admin-created user → activation → wizard, forgot-password, lockout after 3 fails, suspended account, single-session kick, idle warning + timeout, 8-hr max, PWA install on iOS/Android home screen.

## Open items I'd flag before building

- "Notify the Administrator" on lockout — OK to email every user whose `app_role = 'admin'`? (That's the implicit reading.)
- Suspended accounts: the spec says "generic suspension message." Confirm wording, e.g. *"This account is not currently active. Contact your administrator."*
- Activation email sender domain: I'll use the already-configured Lovable email domain. If you'd like activation emails to come from a specific From address (e.g. `admin@medicolegalpro.co.za`), tell me.

Confirm and I'll start with the migration + edge functions.
