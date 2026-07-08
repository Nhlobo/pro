/**
 * ExitConfirmationGuard
 * ---------------------------------------------------------------------------
 * Prevents staff/attorneys/experts from accidentally leaving the app when they
 * tap the phone's back button (Android hardware back button, or a browser/PWA
 * back gesture) while sitting on one of the app's "home" screens — the screens
 * where going back would otherwise exit the app entirely.
 *
 * Why this file was rewritten
 * ---------------------------------------------------------------------------
 * The first version tried to "exit" a web/PWA session by calling
 * window.history.back() again after the user confirmed. That's unreliable for
 * two reasons:
 *   1. A browser tab can't be force-closed by JS at all (window.close() only
 *      works for windows the script itself opened).
 *   2. Going back() one more step often lands on ANOTHER guarded route (e.g.
 *      /auth sits right before /dashboard in history), which immediately
 *      re-triggered this same confirmation — the "popup keeps coming back"
 *      loop that was reported.
 *
 * The fix: stop trying to navigate the browser out of the app at all. Once
 * the user confirms Exit, we show a deterministic, full-screen "you've left
 * the app" state instead — no further history navigation, so there's nothing
 * left to loop. Native (Capacitor) still really exits the app process, since
 * App.exitApp() is a real, reliable API there.
 *
 * How it works
 * ---------------------------------------------------------------------------
 * 1. Web / installed PWA (browser back button or swipe-back gesture):
 *    We can't intercept a native back button, and this repo's guardrail test
 *    (no-browser-dialogs.test.ts) forbids both the beforeunload popup and
 *    window.confirm. Instead we use the standard "sentinel history entry"
 *    technique: whenever the user lands on a guarded "home" route, we push
 *    one extra history entry on top of it. The next back press just pops
 *    that sentinel (a popstate event we control) instead of actually
 *    navigating away, and we show our own branded confirmation dialog:
 *      - Stay  -> re-arm the sentinel, dialog closes, nothing else happens.
 *      - Exit  -> show the terminal "app closed" screen. Done.
 *
 * 2. Native app shell (Capacitor Android/iOS hardware back button):
 *    Once subscribed to @capacitor/app's `backButton` event, default browser
 *    back behaviour no longer happens automatically — we're responsible for
 *    it. On a guarded route we show the same dialog and call App.exitApp()
 *    on confirm. On any other route we replicate default back-button
 *    behaviour with window.history.back(), so normal in-app navigation
 *    (e.g. list -> detail -> back) is unaffected.
 *
 * @capacitor/app is loaded via dynamic import guarded by
 * Capacitor.isNativePlatform(), so this is a harmless no-op on plain web/PWA
 * builds where the plugin isn't present or isn't running inside a native shell.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DoorOpen, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

export function ExitConfirmationGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  const [promptOpen, setPromptOpen] = useState(false);
  const [exited, setExited] = useState(false);

  // Prevents stacking multiple dialogs from rapid repeated back presses (or
  // both the popstate and Capacitor listeners firing for the same press),
  // and stops the guard from doing anything further once the user has exited.
  const busyRef = useRef(false);

  // Re-arm a sentinel history entry every time we land on a guarded route,
  // so the *next* back press is caught by our popstate handler instead of
  // navigating straight past it.
  useEffect(() => {
    if (exited || !isGuardedPath(location.pathname)) return;
    window.history.pushState(SENTINEL_STATE, "", window.location.href);
  }, [location.pathname, exited]);

  const openExitPrompt = useCallback(() => {
    if (busyRef.current || exited) return false;
    busyRef.current = true;
    setPromptOpen(true);
    return true;
  }, [exited]);

  const handleStay = useCallback(() => {
    setPromptOpen(false);
    busyRef.current = false;
    // Re-arm the sentinel so the guard is still active for the next press.
    window.history.pushState(SENTINEL_STATE, "", window.location.href);
  }, []);

  const handleExit = useCallback(async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { App } = await import("@capacitor/app");
        await App.exitApp();
        return; // App process is being killed — nothing left to do.
      }
    } catch {
      // @capacitor/app not installed, or not running natively — it's a web/PWA build.
    }
    // Web/PWA: nothing can force-close a browser tab. Rather than bounce
    // through history (which is what caused the loop), show a clear, final
    // "you've left the app" screen — and actually end the session while
    // we're at it. Without this, the 15-minute IdleLogoutGuard keeps running
    // in the background (it only checks whether a user is logged in, not
    // whether this screen is showing) and would silently sign the user out
    // behind this overlay later. We call Supabase directly instead of the
    // shared signOut() helper because that helper hard-redirects the page
    // to /auth immediately, which would blow away this screen before it
    // ever rendered.
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("supabase.auth.") || key.includes("sb-")) {
          localStorage.removeItem(key);
        }
      });
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Best-effort — still show the exited screen either way.
    }
    setPromptOpen(false);
    setExited(true);
  }, []);

  // --- Web / installed-PWA back button & swipe-back gesture -----------------
  useEffect(() => {
    const handlePopState = () => {
      if (exited || !isGuardedPath(window.location.pathname)) return;

      // Re-arm immediately so the page doesn't visibly navigate away while
      // the confirmation dialog is open, and keep the router's own state
      // pinned to the guarded route.
      window.history.pushState(SENTINEL_STATE, "", window.location.href);
      navigate(window.location.pathname + window.location.search, { replace: true });

      openExitPrompt();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate, openExitPrompt, exited]);

  // --- Native hardware back button (Capacitor Android/iOS) ------------------
  useEffect(() => {
    let cancelled = false;
    let removeListener: (() => void) | null = null;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", () => {
          if (exited) return;
          if (!isGuardedPath(window.location.pathname)) {
            // Not on a "home" screen — replicate default back-button
            // behaviour so normal in-app navigation keeps working.
            window.history.back();
            return;
          }
          openExitPrompt();
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
  }, [openExitPrompt, exited]);

  // Escape hatch if a user ends up on the terminal "exited" screen by
  // mistake (web/PWA only — native truly quits so this never renders there).
  // The session was ended when they exited, so this goes to login, not
  // straight back into a protected page.
  const handleReopen = useCallback(() => {
    setExited(false);
    navigate("/auth", { replace: true });
  }, [navigate]);

  return (
    <>
      <AlertDialog open={promptOpen} onOpenChange={(o) => !o && handleStay()}>
        <AlertDialogContent className="w-full max-w-xs rounded-none border-none bg-white p-5 shadow-2xl sm:max-w-sm">
          <AlertDialogHeader className="flex-row items-center gap-3 space-y-0 text-left sm:text-left">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5">
              <DoorOpen className="h-4 w-4 text-black" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-bold text-black">
                Exit app?
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-0.5 text-xs text-slate-600">
                Unsaved changes on this screen may be lost.
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-row justify-end gap-2">
            <AlertDialogAction
              onClick={handleStay}
              className="h-8 rounded-none bg-black px-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-black/85"
            >
              Stay
            </AlertDialogAction>
            <AlertDialogCancel
              onClick={handleExit}
              className="mt-0 h-8 rounded-none border border-black/15 px-3 text-xs font-semibold uppercase tracking-wide text-black hover:bg-black/5"
            >
              Exit
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {exited && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center gradient-nav p-4">
          <div className="flex w-full max-w-xs items-center gap-3 bg-white p-5 shadow-2xl sm:max-w-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5">
              <DoorOpen className="h-4 w-4 text-black" />
            </div>
            <div className="flex-1">
              <h1 className="text-sm font-bold text-black">You&rsquo;ve exited</h1>
              <p className="mt-0.5 text-xs text-slate-600">You can close this tab now.</p>
            </div>
            <Button
              onClick={handleReopen}
              size="sm"
              className="h-8 shrink-0 rounded-none bg-black px-3 text-xs font-semibold uppercase tracking-wide text-white hover:bg-black/85"
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Log in
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
