/**
 * Synchronous, race-free cache of "is the current session an
 * external-portal session (referring attorney / medical expert who
 * logged in via emailed link + OTP)?"
 *
 * Why this exists: `useIsExternalPortalUser` answers the same question
 * but does it by querying `profiles` after `user` is set, and resets
 * to `false` the instant `user` goes null. That's fine while someone
 * is actively using the app, but it's useless for anything that has
 * to make a routing decision AT THE MOMENT of sign-out (or when a
 * session is found to be invalid) — by the time those checks run,
 * `user` is already null and the async query hasn't (and can't
 * usefully) come back yet. Any guard that redirects on `!user` — sign
 * out, ProtectedRoute's "not authenticated" redirect, a getSession()
 * error path, etc. — would fall back to the staff `/auth` page for
 * everyone, external portal users included.
 *
 * The fix: cache the flag the moment it's known (right after sign-in,
 * while a session still exists), and read it synchronously wherever a
 * redirect target has to be picked.
 *
 * SECURITY: this MUST be `sessionStorage`, not `localStorage`.
 * `localStorage` is shared live, in real time, across every tab of the
 * origin — so the instant any one tab signs in as an external-portal
 * account, every OTHER tab (including an internal staff tab that has
 * nothing to do with that sign-in) would read this flag as `true` too.
 * That was the exact cause of a real incident: a staff member logging
 * out of the Internal System in one tab was redirected to the External
 * Portal sign-in page, because some other tab had an external-portal
 * session marked. `sessionStorage` is scoped to this browsing-context's
 * tab only (matching where the Supabase session itself lives — see
 * `src/integrations/supabase/client.ts`), so it can only ever reflect
 * *this* tab's own sign-in, never another tab's.
 *
 * Deliberately NOT cleared on sign-out (or on a session found to be
 * invalid). This flag drives a routing decision only — it has no bearing
 * on data access, which is fully governed by the real Supabase session +
 * RLS — so there is nothing sensitive about it surviving. What it needs
 * to survive for is the exact scenario sign-out itself creates: after
 * `signOut()`, `user` goes null but old, already-rendered pages can still
 * be reached via the browser Back button (or restored from bfcache).
 * ProtectedRoute's "no user" guard fires again on any of those and calls
 * `postSignOutPath()` a second time — if the flag had already been wiped
 * by the sign-out that just happened, that second call would wrongly
 * resolve to the internal staff `/auth`, which is exactly the "back
 * button sends an external attorney/expert to the staff login page" bug.
 * `sessionStorage` still satisfies this: it survives page reloads and
 * in-tab Back/Forward navigation exactly like `localStorage` does — it
 * only stops surviving once the tab itself is closed, which is fine,
 * since there is no "wrong tab" left to route at that point.
 * It is only ever overwritten (never blanked) — by `markExternalPortalSession`
 * right after the next real sign-in, whoever that is, in this tab.
 */

const STORAGE_KEY = 'mlp.external-portal-session';

export function markExternalPortalSession(isExternal: boolean): void {
  try {
    if (isExternal) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* sessionStorage may be unavailable in some contexts */
  }
}

export function isExternalPortalSession(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function clearExternalPortalSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sessionStorage may be unavailable in some contexts */
  }
}

/** The page an external-portal user should land on vs. the internal staff login. */
export const EXTERNAL_PORTAL_SIGN_IN_PATH = '/external-portal/sign-in';
export const STAFF_SIGN_IN_PATH = '/auth';

export function postSignOutPath(): string {
  return isExternalPortalSession() ? EXTERNAL_PORTAL_SIGN_IN_PATH : STAFF_SIGN_IN_PATH;
  }
