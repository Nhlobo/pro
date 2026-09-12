import { useEffect, useState } from 'react';
import { Fingerprint, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useIsExternalPortalUser } from '@/hooks/useIsExternalPortalUser';
import {
  enrollTrustedDevice,
  getBiometricSupportStatus,
  getDismissedKey,
  isTrustedDeviceEnrolled,
} from '@/utils/trustedDevice';

/**
 * A small, dismissible, bottom-corner nudge offering to enable
 * biometric unlock on this browser. Mounted once at the app root
 * (see App.tsx, inside BiometricLockGate) so it can appear on any
 * authenticated screen — not tied to a single settings page.
 *
 * Staff-only, same as BiometricLockGate itself: referring
 * attorneys/medical experts (link + OTP login) never see this, since
 * they have no password account for biometrics to be a shortcut for.
 *
 * Deliberately quiet by default — it only appears when the device can
 * actually support it, the account has never enrolled a device, and
 * the person hasn't dismissed it before on this browser. A dismissal
 * is remembered per email (see getDismissedKey) so it never nags on
 * every sign-in.
 */
export const BiometricEnrollPrompt = () => {
  const { user, loading } = useAuth();
  const isExternalPortalUser = useIsExternalPortalUser();
  const [visible, setVisible] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (loading || isExternalPortalUser || !user?.email) {
        if (active) setVisible(false);
        return;
      }
      if (isTrustedDeviceEnrolled(user.email)) {
        if (active) setVisible(false);
        return;
      }
      try {
        if (localStorage.getItem(getDismissedKey(user.email)) === 'true') {
          if (active) setVisible(false);
          return;
        }
      } catch {
        // localStorage unavailable (private browsing, etc.) — fall through
        // and still offer the prompt rather than silently hiding it.
      }
      const support = await getBiometricSupportStatus();
      if (active) setVisible(support.status === 'available');
    };
    check();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email, loading, isExternalPortalUser]);

  const dismiss = () => {
    if (user?.email) {
      try {
        localStorage.setItem(getDismissedKey(user.email), 'true');
      } catch {
        // best-effort only — worst case the prompt reappears next sign-in
      }
    }
    setVisible(false);
  };

  const enroll = async () => {
    if (!user?.id || !user?.email) return;
    setEnrolling(true);
    const result = await enrollTrustedDevice({
      userId: user.id,
      userEmail: user.email,
      label: navigator.platform || 'Trusted device',
    });
    setEnrolling(false);
    if (result.ok) {
      toast.success('Biometric unlock enabled on this device.');
      setVisible(false);
    } else {
      toast.error(result.error || 'Could not enable biometric unlock.');
      // Don't dismiss on failure — the person may want to retry (e.g. after
      // setting up a fingerprint/face unlock) rather than lose the offer.
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm animate-in fade-in slide-in-from-bottom-2">
      <Card className="rounded-none border-black/10 shadow-lg">
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00BAAD]/10 text-[#00BAAD]">
              <Fingerprint className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm">Enable biometric unlock?</CardTitle>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="text-slate-400 transition-colors hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          <CardDescription className="text-xs">
            Use your fingerprint or face unlock to sign in faster on this device. Your password always remains available as a backup.
          </CardDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="rounded-none" onClick={dismiss} disabled={enrolling}>
              Not now
            </Button>
            <Button
              size="sm"
              className="rounded-none bg-[#00BAAD] text-white hover:bg-[#00BAAD]/90"
              onClick={enroll}
              disabled={enrolling}
            >
              {enrolling ? 'Enabling…' : 'Enable'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
