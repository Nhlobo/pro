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
 * The fix: cache the flag in localStorage the moment it's known (right
 * after sign-in, while a session still exists), and read it
 * synchronously wherever a redirect target has to be picked.
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
 * It is only ever overwritten (never blanked) — by `markExternalPortalSession`
 * right after the next real sign-in, whoever that is.
 */

const STORAGE_KEY = 'mlp.external-portal-session';

export function markExternalPortalSession(isExternal: boolean): void {
  try {
    if (isExternal) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* localStorage may be unavailable in some contexts */
  }
}

export function isExternalPortalSession(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function clearExternalPortalSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage may be unavailable in some contexts */
  }
}

/** The page an external-portal user should land on vs. the internal staff login. */
export const EXTERNAL_PORTAL_SIGN_IN_PATH = '/external-portal/sign-in';
export const STAFF_SIGN_IN_PATH = '/auth';

export function postSignOutPath(): string {
  return isExternalPortalSession() ? EXTERNAL_PORTAL_SIGN_IN_PATH : STAFF_SIGN_IN_PATH;
  }
