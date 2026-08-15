import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Fingerprint, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useIsExternalPortalUser } from '@/hooks/useIsExternalPortalUser';
import { clearTrustedDevice, getEnrolledEmail, getLastUnlockAgeMs, isBiometricSupported, isTrustedDeviceEnrolled, markUnlocked, verifyTrustedDevice } from '@/utils/trustedDevice';

// Routes that must never be blocked by the biometric lock screen, even if a
// session happens to be present. /reset-password in particular runs on the
// short-lived "recovery" session created by clicking a password-reset email
// link — that session carries a real user, so without this exclusion a staff
// member with biometrics enrolled on that device would land on a fingerprint
// prompt instead of the "set new password" form and have no way past it.
const BIOMETRIC_LOCK_EXEMPT_PATHS = ['/reset-password', '/auth', '/email-confirmation'];

export const BiometricLockGate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  // Biometric/trusted-device lock is a staff-only feature. Referring
  // attorneys/medical experts (link + OTP login) must never hit this lock
  // screen — treat them the same as an exempt route.
  const isExternalPortalUser = useIsExternalPortalUser();
  const location = useLocation();
  const exempt = BIOMETRIC_LOCK_EXEMPT_PATHS.includes(location.pathname) || isExternalPortalUser;
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const check = async () => {
      setChecking(true); setError('');
      if (exempt || loading || !user?.email) { if (active) { setLocked(false); setChecking(false); } return; }
      if (!await isBiometricSupported()) { if (active) { setLocked(false); setChecking(false); } return; }
      const enrolledEmail = getEnrolledEmail();
      if (enrolledEmail && enrolledEmail.toLowerCase() !== user.email.toLowerCase()) clearTrustedDevice();
      const recentlyUnlocked = (getLastUnlockAgeMs() ?? Infinity) < 8 * 60 * 60 * 1000;
      if (active) { setLocked(isTrustedDeviceEnrolled(user.email) && !recentlyUnlocked); setChecking(false); }
    };
    check();
    return () => { active = false; };
  }, [user?.id, user?.email, loading, exempt]);

  const unlock = async () => {
    setError('');
    const result = await verifyTrustedDevice(user?.email);
    if (result.verified) { markUnlocked(); setLocked(false); return; }
    setError(result.error || 'Biometric unlock was cancelled or failed. You can retry or sign in with your password instead.');
    if (user?.email && !isTrustedDeviceEnrolled(user.email)) setLocked(false);
  };
  // Reuse the shared signOut() (from useAuth) instead of hardcoding a
  // redirect here — it already knows whether this account is a staff
  // account (→ /auth) or an external-portal account (→
  // /external-portal/sign-in) and clears the trusted device as part of
  // full cleanup, so this screen never sends anyone to the wrong login page.
  const password = async () => { clearTrustedDevice(); await signOut(); };

  if (exempt || checking || !locked) return <>{children}</>;
  return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4"><Card className="w-full max-w-md"><CardHeader className="text-center"><div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700"><LockKeyhole /></div><CardTitle>Unlock trusted device</CardTitle><CardDescription>Verify this enrolled device to continue. Your password always remains available as a backup.</CardDescription></CardHeader><CardContent className="space-y-3"><Button className="w-full" onClick={unlock}><Fingerprint className="mr-2 h-4 w-4" />Unlock with biometrics</Button><Button variant="outline" className="w-full" onClick={password}>Sign in with password instead</Button>{error && <p className="text-sm text-destructive">{error}</p>}</CardContent></Card></div>;
};
