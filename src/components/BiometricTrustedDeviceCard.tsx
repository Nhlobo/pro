import { useEffect, useState } from 'react';
import { ExternalLink, Fingerprint, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import {
  canOpenBiometricSettingsDirectly,
  detectDevicePlatform,
  enrollTrustedDevice,
  fetchServerDevices,
  getManualBiometricSetupInstructions,
  isTrustedDeviceEnrolled,
  openBiometricDeviceSettings,
  revokeServerDevice,
  ServerTrustedDevice,
} from '@/utils/trustedDevice';

export const BiometricTrustedDeviceCard = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<ServerTrustedDevice[]>([]);
  const [busy, setBusy] = useState(false);
  // Tracks the "no fingerprint/face/PIN set up yet" case specifically, so we can offer
  // a settings redirect + retry instead of a one-shot toast the user can't act on.
  const [needsDeviceSetup, setNeedsDeviceSetup] = useState(false);

  const load = async () => { if (user?.id) setDevices(await fetchServerDevices(user.id)); };
  useEffect(() => { load(); }, [user?.id]);

  const enroll = async () => {
    if (!user?.email) return;
    setBusy(true);
    setNeedsDeviceSetup(false);
    const result = await enrollTrustedDevice({ userId: user.id, userEmail: user.email, label: navigator.platform || 'Trusted device' });
    if (!result.ok) {
      toast.error(result.error || 'Could not enable biometric unlock.');
      if (result.status === 'no-platform-authenticator') setNeedsDeviceSetup(true);
    }
    await load();
    setBusy(false);
  };

  const revoke = async (id: string) => { setBusy(true); await revokeServerDevice(id, 'Revoked by user'); await load(); setBusy(false); };

  const platform = detectDevicePlatform();
  const canDeepLink = canOpenBiometricSettingsDirectly();
  const goToSettings = () => {
    // Best-effort only: this is an Android intent:// link, there's no browser API to
    // open OS settings on any platform. It can't auto-resume enrollment when the user
    // comes back either (WebAuthn requires a fresh tap), so "Try again" below is a
    // separate, deliberate step.
    const opened = openBiometricDeviceSettings();
    if (!opened) toast.info(getManualBiometricSetupInstructions(platform));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5" />Biometric trusted devices</CardTitle>
        <CardDescription>Manage optional device-level biometric unlock. Password sign-in remains available.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">This device</p>
              <p className="text-sm text-muted-foreground">{isTrustedDeviceEnrolled(user?.email) ? 'Biometric unlock is enabled here.' : 'Biometric unlock is not enabled on this browser.'}</p>
            </div>
            {!isTrustedDeviceEnrolled(user?.email) && <Button onClick={enroll} disabled={busy}>{needsDeviceSetup ? 'Try again' : 'Enable on this device'}</Button>}
          </div>
          {needsDeviceSetup && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="mb-2">No fingerprint, face unlock, or screen lock is set up on this device yet.</p>
              {canDeepLink ? (
                <Button variant="outline" size="sm" onClick={goToSettings}><ExternalLink className="mr-1 h-4 w-4" />Open device settings</Button>
              ) : (
                <p className="text-muted-foreground">{getManualBiometricSetupInstructions(platform)}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">After setting it up, come back here and tap "Try again."</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Enrolled devices</p><Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button></div>
          {devices.length === 0 ? <p className="text-sm text-muted-foreground">No trusted devices enrolled.</p> : devices.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-teal-600" />{d.device_label}</p>
                <p className="truncate text-xs text-muted-foreground">{d.platform || d.user_agent || 'Unknown platform'} · Last used {d.last_used_at ? new Date(d.last_used_at).toLocaleString() : 'never'}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => revoke(d.id)} disabled={busy}><Trash2 className="mr-1 h-4 w-4" />Revoke</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
