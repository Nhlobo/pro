import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { enrollTrustedDevice, getDismissedKey, isBiometricSupported, isTrustedDeviceEnrolled } from '@/utils/trustedDevice';
import { toast } from 'sonner';

export const BiometricEnrollPrompt = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; (async () => { if (loading || !user?.email) return; if (localStorage.getItem(getDismissedKey(user.email))) return; if (isTrustedDeviceEnrolled(user.email)) return; if (!await isBiometricSupported()) return; if (active) setOpen(true); })(); return () => { active = false; }; }, [user?.id, user?.email, loading]);
  const dismiss = () => { if (user?.email) localStorage.setItem(getDismissedKey(user.email), 'true'); setOpen(false); };
  // NOTE: enrollTrustedDevice() resolves to { ok, error, status } — never a bare boolean —
  // so this must check result.ok, not the object itself (which is always truthy).
  // Checking the object directly silently treated every failure as success.
  const enable = async () => { if (!user?.email) return; setBusy(true); const result = await enrollTrustedDevice({ userId: user.id, userEmail: user.email, label: navigator.platform || 'Trusted device' }); setBusy(false); if (result.ok) { setOpen(false); } else { toast.error(result.error || 'Could not enable biometric unlock.'); dismiss(); } };
  return <Dialog open={open} onOpenChange={(v) => !v && dismiss()}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5" />Enable biometric sign-in?</DialogTitle><DialogDescription>Add this device as trusted so future app launches can be unlocked with Face ID, Touch ID, Windows Hello, or Android biometrics. Your email and password will still work as a backup.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={dismiss}>Not now</Button><Button onClick={enable} disabled={busy}>{busy ? 'Enabling…' : 'Enable biometrics'}</Button></DialogFooter></DialogContent></Dialog>;
};
