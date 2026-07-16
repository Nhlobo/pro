import { useEffect, useState } from 'react';
import { ExternalLink, Fingerprint, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  AdminCard,
  AdminCardBody,
  AdminCardHeader,
  AdminPill,
} from '@/components/admin/ui/AdminUI';
import {
  canOpenBiometricSettingsDirectly,
  clearTrustedDevice,
  detectDevicePlatform,
  enrollTrustedDevice,
  fetchServerDevices,
  getManualBiometricSetupInstructions,
  isTrustedDeviceEnrolled,
  openBiometricDeviceSettings,
  removeTrustedDevice,
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

  const load = async () => {
    if (!user?.id) return;
    const serverDevices = await fetchServerDevices(user.id);
    setDevices(serverDevices);
    // Self-heal: if the server has no active (non-revoked) device for this user but this
    // browser still thinks it's enrolled, the local flag is stale (e.g. it was revoked
    // from this card, from another device, or by an admin). Left alone, the lock screen
    // would keep showing "Unlock with biometrics" and fail every time with a confusing
    // "No enrolled biometric devices for this account" error. Clear it so the UI falls
    // back to offering enrollment again instead of a dead-end unlock button.
    const hasActiveServerDevice = serverDevices.some((d) => !d.revoked_at);
    if (!hasActiveServerDevice && user.email && isTrustedDeviceEnrolled(user.email)) {
      clearTrustedDevice();
    }
  };
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

  const revoke = async (id: string, credentialId: string) => {
    setBusy(true);
    await revokeServerDevice(id, 'Revoked by user');
    removeTrustedDevice(credentialId);
    await load();
    setBusy(false);
  };

  const platform = detectDevicePlatform();
  const canDeepLink = canOpenBiometricSettingsDirectly();
  const enrolled = isTrustedDeviceEnrolled(user?.email);

  const goToSettings = () => {
    // Best-effort only: this is an Android intent:// link, and there's no browser API to
    // open OS settings on any platform or to confirm it actually landed — some browsers/
    // webviews silently swallow it. We never rely on that outcome: the manual instructions
    // below are always visible too, so the user is never stuck with a button that "does
    // nothing" and no other way forward.
    openBiometricDeviceSettings();
  };

  return (
    <AdminCard>
      <AdminCardHeader
        icon={Fingerprint}
        title="Biometric Trusted Devices"
        description="Manage optional device-level biometric unlock. Password sign-in always remains available."
      />
      <AdminCardBody className="space-y-4">
        <div className="border border-black/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-black">This device</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {enrolled ? 'Biometric unlock is enabled on this browser.' : 'Biometric unlock is not enabled on this browser.'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AdminPill tone={enrolled ? 'success' : 'neutral'}>{enrolled ? 'Enabled' : 'Not Enabled'}</AdminPill>
              {!enrolled && (
                <Button
                  size="sm"
                  className="rounded-none bg-[#00BAAD] text-white hover:bg-[#00BAAD]/90"
                  onClick={enroll}
                  disabled={busy}
                >
                  {needsDeviceSetup ? 'Try Again' : 'Enable On This Device'}
                </Button>
              )}
            </div>
          </div>

          {needsDeviceSetup && (
            <div className="mt-3 border border-black/10 bg-black/5 p-3 text-xs text-slate-600">
              <p className="mb-2 font-medium text-black">
                No fingerprint, face unlock, or screen lock is set up on this device yet.
              </p>
              <p>{getManualBiometricSetupInstructions(platform)}</p>
              {/* Deep link is a bonus shortcut on Android only, never the only path forward —
                  the instructions above already cover every platform on their own. */}
              {canDeepLink && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-none border-[#00BAAD]/40 text-[#00BAAD] hover:bg-[#00BAAD]/10"
                  onClick={goToSettings}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Open Device Settings
                </Button>
              )}
              <p className="mt-2 text-[11px] text-slate-400">After setting it up, come back here and tap "Try Again."</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Enrolled Devices</p>
            <Button variant="ghost" size="sm" className="h-7 rounded-none px-2" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          {devices.length === 0 ? (
            <p className="border border-black/10 p-3 text-xs text-slate-500">No trusted devices enrolled.</p>
          ) : (
            devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 border border-black/10 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-black">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#00BAAD]" />
                    <span className="truncate">{d.device_label}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {d.platform || d.user_agent || 'Unknown platform'} · Last used {d.last_used_at ? new Date(d.last_used_at).toLocaleString() : 'never'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AdminPill tone="success">Active</AdminPill>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => revoke(d.id, d.credential_id)}
                    disabled={busy}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </AdminCardBody>
    </AdminCard>
  );
};
