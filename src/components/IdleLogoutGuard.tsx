import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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
 */
const IDLE_WARNING_MS = 15 * 60 * 1000;
const COUNTDOWN_SECONDS = 60;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

const IdleLogoutGuard = () => {
  const { user, signOut } = useAuth();
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

  useEffect(() => {
    if (!user) return;

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
  }, [user, recordActivity, checkIdleOnResume, signOut]);

  if (!user) return null;

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
