import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useIsExternalPortalUser } from '@/hooks/useIsExternalPortalUser';
import { isExternalPortalSession } from '@/utils/externalPortalSession';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

/**
 * Inactivity guard, entirely client-side.
 *
 * After 15 minutes with no mouse/keyboard/touch/scroll activity, shows an
 * "Are you still working?" confirmation with a visible countdown. If there's
 * no explicit response before the countdown ends, the user is signed out —
 * same client-side signOut() used everywhere else in the app, no backend
 * or database calls added here.
 *
 * While the prompt is showing, general mouse movement does NOT dismiss it —
 * only the two buttons below count as a response. Otherwise the countdown
 * could never actually complete (e.g. if the mouse happens to be resting
 * over the page).
 *
 * Backgrounded tabs/apps: browsers throttle or fully suspend our interval
 * while the tab/app is hidden, so it can't reliably notice 15 minutes have
 * passed while you're away. Worse, the very tap/click used to bring the
 * app back to the foreground fires as a normal activity event and would
 * silently reset the clock before the interval ever got a chance to check
 * it — so the warning would never show even after a long absence. To fix
 * this, a `visibilitychange` listener checks elapsed idle time the moment
 * the page becomes visible again, and opens the warning immediately if
 * we've already blown past the threshold, before any resuming tap can
 * reset it.
 *
 * STAFF-ONLY, by design and by construction. This is the internal 15-min
 * inactivity policy for Internal Staff accounts. It must NEVER apply to
 * the External Portal (Referring Attorney / Medical Expert), which:
 *   - runs its own separate, much shorter-lived OTP-based session model,
 *     not the staff password/idle policy, and
 *   - is mounted globally, above <Routes>, so — unlike every other
 *     guard in the tree — it isn't naturally scoped to staff-only routes
 *     and will run on ANY page (including the External Portal's own
 *     sign-in / case-access screens) the instant `user` is truthy.
 *
 * `user` being truthy is not, by itself, a safe proxy for "this is a
 * staff session" — a real Supabase Auth session backs BOTH staff and
 * bridged External Portal accounts (see useAuth.tsx), and a stale
 * session can still be present on a public entry route (e.g. a
 * back-button/bfcache hit on the External Portal sign-in page right
 * after a real sign-out, before that page's own redirect takes over).
 * So exemption here is layered, not single-signal:
 *
 *   1. Path: any External Portal route (sign-in, case-access links, or
 *      the /attorney-portal /expert-portal dashboards themselves) is
 *      exempt immediately, synchronously, from the very first render —
 *      no dependency on `user` or on any async lookup resolving first.
 *      This is what stops it from ever showing up on the sign-in page.
 *   2. Session type: `isExternalPortalSession()` is the same
 *      synchronous, race-free cache the app already uses elsewhere
 *      (sign-out routing, BiometricLockGate) to answer "is the
 *      account behind this session an External Portal account?"
 *      without waiting on a fresh profiles query. Checked first because
 *      it's instant.
 *   3. `useIsExternalPortalUser()` backs it up once its query resolves,
 *      in case this tab's cache hasn't been set yet.
 *
 * Any one of these being true means the guard does nothing: no
 * listeners attached, no timer started, dialog force-closed if for any
 * reason it was already open.
 */
const IDLE_WARNING_MS = 15 * 60 * 1000;
const COUNTDOWN_SECONDS = 60;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

// External Portal surface: the shared sign-in flow, the link-based
// case-access entry points, and the bridged attorney/expert dashboards
// themselves. Exact matches for the entry points, prefix matches for the
// portal dashboards (which have many sub-routes). Deliberately does NOT
// match staff-facing paths that merely contain "attorney"/"expert"
// (e.g. /attorney-referral-intelligence, /referring-attorney-list,
// /admin/attorney-crm) — those are internal staff tooling and the idle
// guard is exactly right to keep running there.
const EXTERNAL_PORTAL_EXACT_PATHS = [
  '/external-portal/sign-in',
  '/Attorneyzone/case-access',
  '/Expertzone/case-access',
];
const EXTERNAL_PORTAL_PATH_PREFIXES = ['/attorney-portal', '/expert-portal'];

function isExternalPortalPath(pathname: string): boolean {
  if (EXTERNAL_PORTAL_EXACT_PATHS.includes(pathname)) return true;
  return EXTERNAL_PORTAL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

const IdleLogoutGuard = () => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const isExternalPortalUserAsync = useIsExternalPortalUser();

  // Path check is synchronous and available on the very first render —
  // it's what guarantees this never even arms itself on the sign-in page.
  // The session-cache and async-hook checks are extra layers so the
  // exemption also holds for a stale session that ends up on a
  // non-External-Portal-looking URL, or before the async check resolves.
  const exemptFromIdleGuard =
    isExternalPortalPath(location.pathname) ||
    isExternalPortalSession() ||
    isExternalPortalUserAsync;

  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  const lastActivityRef = useRef(Date.now());
  const warningOpenRef = useRef(false);
  warningOpenRef.current = warningOpen;

  const recordActivity = useCallback(() => {
    if (warningOpenRef.current) return;
    lastActivityRef.current = Date.now();
  }, []);

  // Runs the instant the tab/app becomes visible again — before any
  // resuming click/touch event can reach recordActivity and reset the
  // clock. If we were away for 15+ minutes, show the warning right away
  // instead of silently letting the resuming tap count as "activity".
  const checkIdleOnResume = useCallback(() => {
    if (document.hidden) return;
    if (warningOpenRef.current) return;
    const idleFor = Date.now() - lastActivityRef.current;
    if (idleFor >= IDLE_WARNING_MS) {
      setSecondsLeft(COUNTDOWN_SECONDS);
      setWarningOpen(true);
    }
  }, []);

  const stayActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(COUNTDOWN_SECONDS);
    setWarningOpen(false);
  }, []);

  const logoutNow = useCallback(() => {
    void signOut();
  }, [signOut]);

  // If the exemption flips to true while a warning happens to already be
  // showing (e.g. the async External Portal check resolves mid-countdown),
  // force it closed rather than leaving a stray "you'll be signed out"
  // dialog on a session this guard no longer has any business touching.
  useEffect(() => {
    if (exemptFromIdleGuard) {
      setWarningOpen(false);
      setSecondsLeft(COUNTDOWN_SECONDS);
    }
  }, [exemptFromIdleGuard]);

  useEffect(() => {
    if (!user || exemptFromIdleGuard) return;

    // Entering a fresh, non-exempt session: start the idle clock from now,
    // not from whenever this component instance happened to last mount.
    lastActivityRef.current = Date.now();

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, recordActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', checkIdleOnResume);

    const tick = window.setInterval(() => {
      if (!warningOpenRef.current) {
        const idleFor = Date.now() - lastActivityRef.current;
        if (idleFor >= IDLE_WARNING_MS) {
          setSecondsLeft(COUNTDOWN_SECONDS);
          setWarningOpen(true);
        }
      } else {
        setSecondsLeft((s) => {
          if (s <= 1) {
            void signOut();
            return 0;
          }
          return s - 1;
        });
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, recordActivity));
      document.removeEventListener('visibilitychange', checkIdleOnResume);
      window.clearInterval(tick);
    };
  }, [user, exemptFromIdleGuard, recordActivity, checkIdleOnResume, signOut]);

  if (!user || exemptFromIdleGuard) return null;

  return (
    <AlertDialog open={warningOpen}>
      <AlertDialogContent className="w-full max-w-md rounded-none border-none bg-white p-8 text-center shadow-2xl">
        <AlertDialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
            <Clock className="h-8 w-8 text-black" />
          </div>
          <AlertDialogTitle className="text-2xl font-bold text-black">
            Are you still working?
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-2 text-sm text-slate-600">
            You&rsquo;ve been inactive for a while. For your security, you&rsquo;ll be signed out
            in <span className="font-semibold text-black">{secondsLeft}s</span> unless you
            confirm you&rsquo;re still here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <AlertDialogAction
            onClick={stayActive}
            className="h-11 rounded-none bg-black font-semibold uppercase tracking-wide text-white hover:bg-black/85"
          >
            Yes, I&rsquo;m still here
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={logoutNow}
            className="mt-0 h-11 rounded-none border border-black/15 font-semibold uppercase tracking-wide text-black hover:bg-black/5"
          >
            Log out
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default IdleLogoutGuard;
