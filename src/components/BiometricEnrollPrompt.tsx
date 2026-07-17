import { useEffect, useState } from 'react';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  enrollTrustedDevice,
  getDismissedKey,
  isBiometricSupported,
  isTrustedDeviceEnrolled,
} from '@/utils/trustedDevice';

// Brand accent — same teal used across the Admin Portal design system
// (AdminUI.tsx, BiometricTrustedDeviceCard, auth screens).
const BRAND_TEAL = '#00BAAD';

export const BiometricEnrollPrompt = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (loading || !user?.email) return;
      if (localStorage.getItem(getDismissedKey(user.email))) return;
      if (isTrustedDeviceEnrolled(user.email)) return;
      if (!(await isBiometricSupported())) return;
      if (active) setOpen(true);
    })();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email, loading]);

  const dismiss = () => {
    if (user?.email) localStorage.setItem(getDismissedKey(user.email), 'true');
    setOpen(false);
  };

  const enable = async () => {
    if (!user?.email) return;
    setBusy(true);
    const result = await enrollTrustedDevice({
      userId: user.id,
      userEmail: user.email,
      label: navigator.platform || 'Trusted device',
    });
    setBusy(false);
    if (result.ok) {
      setOpen(false);
      return;
    }
    toast.error(result.error || 'Could not enable biometric sign-in.');
    // Keep the prompt open after a failed enrollment so the user is not left
    // thinking biometrics were enabled when no trusted device was actually saved.
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && dismiss()}>
      {/*
        Same hairline-border, square-corner, shadowless surface used by every
        other system card in the app (AdminCard, the trusted-device card, the
        session-timeout dialog). Radix's built-in open/close fade + zoom
        transitions are kept as-is so the entrance/dismissal motion matches
        every other Dialog/AlertDialog in the app.
      */}
      <DialogContent
        className="gap-0 rounded-none border-black/10 bg-white p-0 shadow-none sm:rounded-none"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        <DialogHeader className="gap-0 space-y-0 border-b border-black/10 p-5 text-left sm:text-left">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/5"
              aria-hidden="true"
            >
              <Fingerprint className="h-5 w-5" style={{ color: BRAND_TEAL }} />
            </div>
            <div className="min-w-0 pt-0.5">
              <DialogTitle className="text-base font-bold text-black">
                Enable biometric sign-in?
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                Add this device as trusted so future app launches can be unlocked with Face ID,
                Touch ID, Windows Hello, or Android biometrics. Your email and password will
                still work as a backup.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-start gap-2 border-b border-black/10 bg-black/[0.03] px-5 py-3">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-slate-500">
            You can manage or revoke trusted devices at any time from My Profile.
          </p>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 p-5 pt-4 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            variant="outline"
            className="rounded-none border-black/15 text-black hover:bg-black/5"
            onClick={dismiss}
          >
            Not now
          </Button>
          <Button
            className="rounded-none text-white hover:opacity-90"
            style={{ backgroundColor: BRAND_TEAL }}
            onClick={enable}
            disabled={busy}
          >
            {busy ? 'Enabling…' : 'Enable biometrics'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
