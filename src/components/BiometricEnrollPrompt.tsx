import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { enrollTrustedDevice, getDismissedKey, isBiometricSupported, isTrustedDeviceEnrolled } from '@/utils/trustedDevice';

export const BiometricEnrollPrompt = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; (async () => { if (loading || !user?.email) return; if (localStorage.getItem(getDismissedKey(user.email))) return; if (isTrustedDeviceEnrolled(user.email)) return; if (!await isBiometricSupported()) return; if (active) setOpen(true); })(); return () => { active = false; }; }, [user?.id, user?.email, loading]);
  const dismiss = () => { if (user?.email) localStorage.setItem(getDismissedKey(user.email), 'true'); setOpen(false); };
  const enable = async () => {
    if (!user?.email) return;
    setBusy(true);
    const result = await enrollTrustedDevice({ userId: user.id, userEmail: user.email, label: navigator.platform || 'Trusted device' });
    setBusy(false);
    if (result.ok) { setOpen(false); return; }
    toast.error(result.error || 'Could not enable biometric sign-in.');
    if (result.status !== 'no-platform-authenticator') dismiss();
  };
  return <Dialog open={open} onOpenChange={(v) => !v && dismiss()}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5" />Enable biometric sign-in?</DialogTitle><DialogDescription>Add this device as trusted so future app launches can be unlocked with Face ID, Touch ID, Windows Hello, or Android biometrics. Your email and password will still work as a backup.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={dismiss}>Not now</Button><Button onClick={enable} disabled={busy}>{busy ? 'Enabling…' : 'Enable biometrics'}</Button></DialogFooter></DialogContent></Dialog>;
};
