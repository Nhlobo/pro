# Biometric Sign-In (WebAuthn) & Password Reset — Setup Notes

This document lists the **only** things that must be checked/configured in the backend
console for biometric sign-in and "Forgot Password?" to work. No database schema
changes are required — the tables already exist.

---

## 1. What was broken with biometrics

`resolveRelyingParty()` in `supabase/functions/_shared/webauthn.ts` used to read the
`WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` secrets. **Neither secret is set on this project**,
so every enrollment was generated for the relying party `localhost` with expected origin
`http://localhost:5173`. On the real app domain that ceremony can never succeed, which is
what surfaced as *"internal server error"* when enabling biometrics.

### Fix applied (no backend/database changes)

1. The relying party is now derived from the **request `Origin` header** and validated
   against an allow-list (`localhost`, `127.0.0.1`, `*.lovable.app`, `*.lovableproject.com`,
   plus anything in `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` if you ever set them).
2. Both edge functions now import `@simplewebauthn/server` via the officially supported
   `npm:` specifier instead of `esm.sh?target=deno` (the esm.sh build is the usual cause of
   cold-start 500s in the Deno edge runtime).
3. A failed `trusted_devices` insert now returns the real database message instead of a
   bare 500, so any future problem is diagnosable from the UI.

### Optional (only if you add a custom domain)

Add these secrets so credentials keep working on your own domain:

| Secret            | Example value                                            |
| ----------------- | -------------------------------------------------------- |
| `WEBAUTHN_RP_ID`  | `medicolegalpro.co.za`                                    |
| `WEBAUTHN_ORIGIN` | `https://medicolegalpro.co.za,https://www.medicolegalpro.co.za` |

> Note: a WebAuthn credential is bound to the hostname it was enrolled on. A device
> enrolled on the **preview** URL will not unlock on the **published** URL — users must
> enrol once per domain. This is a WebAuthn platform rule, not an app bug.

### Nothing to run in SQL

`trusted_devices`, `trusted_device_events` and `trusted_device_challenges` all exist with
correct grants and RLS (verified against the live project). Both functions
(`webauthn-register`, `webauthn-authenticate`) are deployed with `verify_jwt = true`.

---

## 2. Password reset

`/reset-password` now accepts **all three** link shapes Supabase can send:

* `#access_token=…&type=recovery` (implicit — auto-detected)
* `?code=…` (PKCE — exchanged with `exchangeCodeForSession`)
* `?token_hash=…&type=recovery` (verified with `verifyOtp`)

### Console checklist (Auth settings)

1. **Site URL** — set to the published app URL (`https://verdict-navigator-suite.lovable.app`).
2. **Redirect URLs** — must include:
   * `https://verdict-navigator-suite.lovable.app/reset-password`
   * `https://id-preview--934240b1-06cb-43b1-bf01-24af31d3e340.lovable.app/reset-password`
   * `http://localhost:8080/reset-password`

   Without these entries Supabase silently drops `redirectTo` and sends the user to the
   Site URL instead, so they land signed-in on `/auth` and never see the new-password form.
3. Email rate limits: the default is a small number of reset emails per hour per project.
   If testing repeatedly you may hit "email rate limit exceeded" — that is expected.
