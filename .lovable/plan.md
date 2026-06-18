## Authentication Module Security Upgrade — Implementation Plan

A focused, surgical upgrade of ONLY the authentication module. Existing tables, RLS, dashboards, roles, workflows, and the notification/audit systems already in place are left intact and reused where the spec requires.

### Scope guardrails
- No changes to existing RLS, role lookups, dashboards, business tables, expert/payment/chat/notification subsystems beyond *calling into* the existing `notifications` / `audit_logs` tables.
- All new behavior is additive: new tables, new edge functions, new wizard route, new login flow, plus a `security_setup_completed` flag on `profiles`.

---

### 1. Database changes (one migration)

**Alter existing tables (additive only):**
- `profiles`: add `security_setup_completed boolean default false`, `account_status text default 'active'` (values: `active | pending_activation | suspended | disabled`), `failed_login_count int default 0`, `locked_until timestamptz`, `must_reset_password boolean default false`.
- Backfill: every existing user → `security_setup_completed = false`, `account_status = 'active'` (Legacy User path).

**New tables (all with GRANTs + RLS, admin-only reads, insert-only history where relevant):**
- `auth_activation_tokens` — `user_id, token_hash, expires_at, consumed_at, created_by_admin`.
- `auth_password_reset_tokens` — `user_id, token_hash, expires_at, consumed_at`.
- `auth_login_otps` — `user_id, otp_hash, expires_at, attempt_count, superseded_at, purpose` (`login | setup | reset`).
- `auth_active_sessions` — `user_id, session_id (supabase access token jti or random), created_at, last_seen_at, ip, user_agent, revoked_at` (single-session enforcement).
- `auth_events` — append-only audit (login, login_failed, logout, password_created, password_changed, password_reset_*, otp_*, account_*, session_expired, forced_logout, security_setup_*). RLS: admins SELECT only; INSERT via SECURITY DEFINER edge functions. UPDATE/DELETE revoked from all roles including service_role at GRANT level.

All token tables store **only hashes** (sha256 of raw token). Raw values never persisted, never logged.

### 2. Edge functions (all `verify_jwt = false`, in-code auth)

| Function | Purpose |
|---|---|
| `auth-admin-create-user` | Admin-only; creates auth user (no password), pending_activation, generates activation token, emails link, writes event |
| `auth-activate-account` | Consumes activation token, redirects user into Setup Wizard |
| `auth-request-login-otp` | After password verify, mints + emails OTP, invalidates prior OTP |
| `auth-verify-login-otp` | Validates OTP, establishes session, revokes prior sessions, records `auth_active_sessions` |
| `auth-resend-otp` | Throttled to 3 per login attempt |
| `auth-request-password-reset` | Public; always returns generic success; emails reset link if user exists |
| `auth-complete-password-reset` | Consumes reset token, sets new password via admin API, triggers OTP step |
| `auth-admin-user-actions` | suspend / reactivate / disable / unlock / resend-activation / force-reset / force-setup / force-logout-all |
| `auth-validate-session` | Called on every protected route navigation; checks `auth_active_sessions` for single-session + revocation |
| `auth-record-event` | Internal helper used by other functions; never called from client |

Password policy (≥12, upper/lower/digit/special, common-password blocklist) enforced inside `auth-activate-account` and `auth-complete-password-reset`. Frontend mirrors for UX only.

Failed-login protection: `auth-request-login-otp` increments `profiles.failed_login_count`; at 3 → set `locked_until = now() + 15m`, write `account_locked` event, insert admin notification into existing `notifications` table.

### 3. Frontend changes (auth surface only)

- **Disable self-signup**: remove signup tab from `src/pages/Auth.tsx`; Supabase `enable_signup` already won't matter because UI is the only entry point — we also block via edge-function-only user creation.
- **New login flow** (`src/pages/Auth.tsx`): Step 1 email+password → call `auth-request-login-otp` → Step 2 OTP entry → call `auth-verify-login-otp` → session established → redirect.
- **New `src/pages/SecuritySetupWizard.tsx`**: 4 steps (welcome, password, email OTP, confirm). Cannot be skipped — guard is server-side (every protected request checks `security_setup_completed`).
- **New `src/pages/Activate.tsx`**: handles activation token from email link → into Setup Wizard.
- **New `src/pages/ForgotPassword.tsx` + `src/pages/ResetPassword.tsx`**.
- **Update `src/components/ProtectedRoute.tsx`**: after auth + permissions, also block when `security_setup_completed = false` (redirect to wizard) and when `auth-validate-session` returns invalid (redirect to /auth). No protected UI renders during checks.
- **New `src/hooks/useSessionTimeout.tsx`**: 30-min idle auto-logout, warning at 25 min, 8-hour absolute max — wired once at app root.
- **New `src/hooks/useSessionWatcher.tsx`**: polls `auth-validate-session` on focus/interval; on invalid → immediate redirect.
- **Admin panel (`src/pages/UserManagement.tsx` / `AdminIAM`) extensions**: add buttons for suspend, reactivate, disable, unlock, resend activation, force reset, force setup, force logout-all, plus an "Authentication history" drawer reading from `auth_events`. Remove any password input fields from the create-user form. All actions call `auth-admin-user-actions`.

### 4. Email templates
Reuse existing `send-transactional-email` / sender domain. New templates: activation, login OTP, password reset, OTP for setup/reset. Plain-text fallback. No secrets in client.

### 5. Audit & notifications
- Every auth event → `auth_events` insert via SECURITY DEFINER RPC called from edge functions.
- Account lock → insert into existing `notifications` table targeting admins (reuses existing system, not a parallel one).

### 6. What is explicitly NOT touched
Existing RLS on business tables, role enums, `has_role`, permission tables, dashboards, expert/AOD/sales/chat/document/notification logic, `user_roles`, `audit_logs` (we use a separate `auth_events` table to avoid touching its schema/policies).

### 7. Rollout
1. Run migration (additive, safe for existing data).
2. Deploy all new edge functions.
3. Ship frontend changes.
4. First login of every existing user routes through the Setup Wizard exactly once.

### Technical details (for engineering review)
- Token hashing: `encodeHex(sha256(rawToken))`, raw token never returned after generation except in the outgoing email body.
- Single-session: on successful OTP verify, `update auth_active_sessions set revoked_at = now() where user_id = ? and revoked_at is null`, then insert new row with the new session id.
- Session validation: client sends current session id (stored alongside Supabase session in memory only); edge function checks it exists and is not revoked.
- Idle detection: listen to `mousemove/keydown/click/visibilitychange`; debounce, store `lastActivity` in memory only (not localStorage, to avoid cross-tab leak).
- Password blocklist: small static list bundled with `auth-activate-account` / `auth-complete-password-reset` (top ~1k common passwords).
- All edge functions return generic errors on auth-related failures (no enumeration).

Confirm and I'll implement in this order: migration → edge functions → frontend.
