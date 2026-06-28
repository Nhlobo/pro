# Auth Overhaul Plan

**Guarantee:** All existing users keep working passwords. No changes to `auth.users`, no password rehashing, no email/identifier changes. Existing MFA enrollments (TOTP) preserved — we extend, never reset.

---

## 1. New Auth UI (matches uploaded mockup)

Rebuild `src/pages/Auth.tsx` as a multi-step flow on the existing dark hero background:

- **Sign In** — email + password, "Remember me", "Forgot Password?" link. Uses existing `supabase.auth.signInWithPassword` (zero change to credentials).
- **Forgot Password** → email entry → `resetPasswordForEmail({ redirectTo: /reset-password })`.
- **Check Your Email** confirmation screen (60-min expiry copy).
- **/reset-password** route (NEW) — `Create New Password` with live strength rules (8+, upper, lower, number, symbol) → `Confirm New Password` → `updateUser({ password })` → success screen → back to Sign In.
- **Email verification** — handled automatically by Supabase confirm link; new `/auth/verified` lander.
- **Phone verification** — optional step in profile (uses `supabase.auth.updateUser({ phone })` + OTP verify). Not required to log in.
- **Magic Link auto-send for new users** — when a Supabase admin creates a user via `create-user` edge function, automatically send a magic link (`generateLink` type=`magiclink` or `inviteUserByEmail`) so they can set their own password.

All screens keep the existing Kutlwano brand, footer (Privacy/Terms), and "Secure • Confidential • Protected" badges.

---

## 2. Security Layer (additive — opt-in per user, mandatory for sensitive roles)

| Capability | Implementation |
|---|---|
| **MFA (TOTP)** | Already built (`MFASetup.tsx`, `MFARequiredGuard.tsx`) — keep as-is, surface in new **Security Settings** tab |
| **Passkeys / WebAuthn** | New `user_passkeys` table + `useWebAuthn` hook using browser `navigator.credentials`. Stored as additional factor; password login still works |
| **Biometric login** | Passkey flow auto-uses platform authenticator (Face ID / Touch ID / Windows Hello) when available |
| **Remember device** | 30-day signed cookie + row in `trusted_devices`; skips MFA challenge on that device |
| **Trusted devices list** | `trusted_devices` table (user_id, device_fingerprint, name, last_seen, ip, user_agent) |
| **Device management UI** | New `DeviceManagement.tsx` in Security Settings — list, rename, revoke |

---

## 3. Access & Identity Management page

Replace thin `AdminIAM.tsx` wrapper with a tabbed page:

1. **Users** — existing `UserManagement` (unchanged behavior)
2. **Roles & Permissions** — existing `PermissionManagement` surfaced here
3. **Security Policies** — toggle MFA-required-for-role, password policy, session timeout (writes to `system_settings`)
4. **Audit** — link to existing audit trail filtered to auth events

---

## 4. Database (single additive migration, no destructive ops)

```sql
-- Passkeys
CREATE TABLE public.user_passkeys (
  id uuid PK, user_id uuid → auth.users ON DELETE CASCADE,
  credential_id text UNIQUE, public_key text, counter bigint,
  device_name text, created_at, last_used_at
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_passkeys TO authenticated;
GRANT ALL TO service_role;
ALTER TABLE ENABLE RLS;
CREATE POLICY "own passkeys" USING (user_id = auth.uid());

-- Trusted devices
CREATE TABLE public.trusted_devices (
  id uuid PK, user_id uuid → auth.users ON DELETE CASCADE,
  device_token_hash text, device_name text, user_agent text,
  ip_address text, last_seen_at, expires_at, created_at
);
GRANT … same pattern …
```

No changes to existing `auth.users`, `user_roles`, `profiles`. No password resets triggered.

---

## 5. Edge functions

- **Update** `create-user` → after creating user, call `generateLink({ type: 'magiclink' })` and email it via existing Resend helper. Replaces current temp-password flow.
- **New** `webauthn-register-begin` / `webauthn-register-finish` / `webauthn-login-begin` / `webauthn-login-finish`.
- **New** `revoke-trusted-device`.

---

## 6. Testing (Playwright + vitest)

- Existing-user login still works (password unchanged) — Playwright login as `test.admin@medico-legal.test`.
- Forgot password full flow.
- Magic link issued on user creation.
- MFA-enrolled users still get prompted.
- Passkey registration round-trip on Chromium.
- Trusted-device cookie skips MFA on 2nd login.

---

## What WON'T change
- Supabase project, anon key, JWT format, session cookies
- Existing passwords / TOTP secrets
- `auth.users`, `user_roles`, `profiles`, RLS policies
- Role logic, `has_role()` RPC
- All app routes outside `/auth` and `/admin/iam`

Ready to implement on approval.