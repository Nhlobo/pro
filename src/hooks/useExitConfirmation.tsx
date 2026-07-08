/**
 * useExitConfirmation / ExitConfirmationGuard
 * ---------------------------------------------------------------------------
 * Prevents staff/attorneys/experts from accidentally leaving the app when they
 * tap the phone's back button (Android hardware back button, or a browser/PWA
 * back gesture) while sitting on one of the app's "home" screens — the screens
 * where going back would otherwise exit the app entirely (or dump them onto
 * whatever page happened to be open before it, e.g. the OS home screen or the
 * previous site in browser history).
 *
 * How it works
 * ---------------------------------------------------------------------------
 * 1. Web / installed PWA (browser back button or swipe-back gesture):
 *    We can't intercept or preventDefault() a native back button — the
 *    browser guardrail test in this repo (no-browser-dialogs.test.ts) also
 *    forbids the beforeunload popup approach. Instead we use the standard
 *    "sentinel history entry" technique: whenever the user lands on a guarded
 *    "home" route, we push one extra history entry on top of it. The next
 *    back press just pops that sentinel (a `popstate` event we control)
 *    instead of actually navigating away. When that happens we show our own
 *    in-app confirmation (via useConfirm/AlertDialog — never window.confirm),
 *    and:
 *      - Cancel  -> re-arm the sentinel so the guard stays active.
 *      - Exit    -> let the real back navigation proceed.
 *
 * 2. Native app shell (Capacitor Android/iOS hardware back button):
 *    Capacitor's @capacitor/app plugin exposes a `backButton` event. Once you
 *    subscribe to it, YOU become responsible for deciding what happens next
 *    (it does not also fall back to default browser behaviour). On a guarded
 *    route we show the same confirmation dialog and call App.exitApp() if
 *    confirmed. On any other route we simply replicate default back-button
 *    behaviour with window.history.back(), so normal in-app navigation
 *    (e.g. list -> detail -> back) is completely unaffected.
 *
 * @capacitor/app is loaded via dynamic import and guarded with
 * Capacitor.isNativePlatform(), so this hook is a total no-op (aside from the
 * harmless history sentinel) in plain web/PWA builds where the plugin isn't
 * present or isn't running inside a native shell.
 */
import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConfirm } from "@/hooks/useConfirm";

/**
 * "Home" screens for each portal — the natural entry point a user lands on
 * after login. Pressing back from here has nowhere sensible left to go
 * in-app, so it should mean "leave the app", not "log me out unexpectedly"
 * or "take me to a random previous browser page".
 */
const EXIT_GUARD_ROUTES = new Set<string>([
  "/auth",
  "/dashboard",
  "/admin",
  "/attorney-portal",
  "/expert-portal",
]);

const SENTINEL_STATE = { exitGuard: true } as const;

function isGuardedPath(pathname: string): boolean {
  return EXIT_GUARD_ROUTES.has(pathname);
}

export function useExitConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();

  // Prevents stacking multiple confirmation dialogs from rapid repeated
  // back presses (or both listeners firing for the same physical press).
  const dialogOpenRef = useRef(false);

  // Re-arm a sentinel history entry every time we land on a guarded route,
  // so the *next* back press is caught by our popstate handler instead of
  // navigating straight past it.
  useEffect(() => {
    if (!isGuardedPath(location.pathname)) return;
    window.history.pushState(SENTINEL_STATE, "", window.location.href);
  }, [location.pathname]);

  const showExitPrompt = useCallback(async (): Promise<boolean> => {
    if (dialogOpenRef.current) return false;
    dialogOpenRef.current = true;
    try {
      return await confirm({
        title: "Exit app?",
        description:
          "You're about to close Kutlwano & Associate. Any unsaved changes on this screen may be lost.",
        confirmText: "Exit",
        cancelText: "Stay",
      });
    } finally {
      dialogOpenRef.current = false;
    }
  }, [confirm]);

  // Attempts a "real" exit: native app exit inside Capacitor, or falling
  // through to normal browser back navigation on the web/PWA.
  const performExit = useCallback(async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { App } = await import("@capacitor/app");
        await App.exitApp();
        return;
      }
    } catch {
      // @capacitor/app not installed, or not running natively — fall through.
    }
    // Web/PWA: nothing can force-close a browser tab, so let the pending
    // back navigation (past our sentinel) actually happen.
    window.history.back();
  }, []);

  // --- Web / installed-PWA back button & swipe-back gesture -----------------
  useEffect(() => {
    const handlePopState = async () => {
      if (!isGuardedPath(window.location.pathname)) return;

      // Re-arm immediately so the page doesn't visibly navigate away while
      // the confirmation dialog is open, and reset router state back to the
      // guarded route in case the pop already changed it.
      window.history.pushState(SENTINEL_STATE, "", window.location.href);
      navigate(window.location.pathname + window.location.search, { replace: true });

      const shouldExit = await showExitPrompt();
      if (shouldExit) {
        performExit();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate, performExit, showExitPrompt]);

  // --- Native hardware back button (Capacitor Android/iOS) ------------------
  useEffect(() => {
    let cancelled = false;
    let removeListener: (() => void) | null = null;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", async () => {
          if (!isGuardedPath(window.location.pathname)) {
            // Not on a "home" screen — replicate default back-button
            // behaviour so normal in-app navigation keeps working.
            window.history.back();
            return;
          }

          const shouldExit = await showExitPrompt();
          if (shouldExit) {
            App.exitApp();
          }
        });

        if (cancelled) {
          listener.remove();
        } else {
          removeListener = () => listener.remove();
        }
      } catch {
        // @capacitor/app not available — plain web build, nothing to do.
      }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [showExitPrompt]);
}

/** Mount once near the top of the router tree (see App.tsx). Renders nothing. */
export function ExitConfirmationGuard() {
  useExitConfirmation();
  return null;
}
