import { useCallback, useEffect, useRef, useState } from 'react';
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
      window.clearInterval(tick);
    };
  }, [user, recordActivity, signOut]);

  if (!user) return null;

  return (
    <AlertDialog open={warningOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still working?</AlertDialogTitle>
          <AlertDialogDescription>
            You&rsquo;ve been inactive for a while. For your security, you&rsquo;ll be signed out
            in <span className="font-semibold text-foreground">{secondsLeft}s</span> unless you
            confirm you&rsquo;re still here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={logoutNow}>Log out</AlertDialogCancel>
          <AlertDialogAction onClick={stayActive}>Yes, I&rsquo;m still here</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default IdleLogoutGuard;
