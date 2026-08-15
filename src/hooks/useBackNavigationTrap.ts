import { useEffect } from 'react';

/**
 * Traps the browser/OS Back button on whatever page calls this hook.
 *
 * There is no cross-browser API to actually close a tab that the page
 * itself didn't open (`window.close()` is a no-op on a normal
 * user-navigated tab), so "close the tab" isn't something a web app can
 * force. The equivalent, and what every bank/portal-style app actually
 * ships, is a Back trap: pressing Back never lands anywhere — it just
 * re-lands on this same page — so a previously rendered authenticated
 * screen (staff or external-portal) can never be reached that way.
 *
 * Pair this with the `pageshow`/bfcache guard in ProtectedRoute, which
 * covers the other half of this: making sure a protected page itself
 * re-validates instead of showing a stale cached render if it's ever the
 * one restored via back/forward navigation.
 *
 * Scope this hook to pages where landing here specifically means "someone
 * just signed out (or a stale session bounced them here) and must not be
 * able to back their way into what they were just looking at" — e.g. the
 * external-portal and staff sign-in pages. Do not add it to ordinary
 * pages; it intentionally disables normal Back navigation.
 */
export function useBackNavigationTrap(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    // Push a throwaway entry so there's always something in front of
    // wherever the user actually came from. Back then triggers popstate
    // instead of a real navigation.
    window.history.pushState(null, '', window.location.href);

    const trap = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', trap);
    return () => window.removeEventListener('popstate', trap);
  }, [enabled]);
}
