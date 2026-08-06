import { useEffect, useMemo, useState } from 'react';
import { Fingerprint, MapPin, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AdminCard,
  AdminCardBody,
  AdminCardHeader,
  AdminPill,
} from '@/components/admin/ui/AdminUI';
import {
  AdminTrustedDevice,
  fetchAdminTrustedDevices,
  formatDeviceLocation,
  revokeServerDevice,
} from '@/utils/trustedDevice';

/**
 * Access & IAM admin view of every user's enrolled biometric devices. Lets an
 * admin revoke a device on someone else's behalf — the main real-world use
 * case being a staff member who's lost their phone and needs biometric
 * sign-in cleared so they can re-enroll on a new device.
 *
 * Relies entirely on the existing admin RLS policies on trusted_devices /
 * profiles (the same "OR has_role(auth.uid(), 'admin')" checks the rest of
 * the app already uses) — a non-admin who somehow rendered this component
 * would just see their own device(s), nothing more.
 */
export const AdminTrustedDevicesCard = () => {
  const [devices, setDevices] = useState<AdminTrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setDevices(await fetchAdminTrustedDevices());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const revoke = async (device: AdminTrustedDevice) => {
    setBusyId(device.id);
    const ok = await revokeServerDevice(device.id, 'Revoked by admin');
    if (!ok) {
      toast.error('Could not revoke this device. Please try again.');
    } else {
      toast.success(`Revoked "${device.device_label}" for ${device.user_name}.`);
    }
    await load();
    setBusyId(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.user_name.toLowerCase().includes(q) ||
        (d.user_email ?? '').toLowerCase().includes(q) ||
        d.device_label.toLowerCase().includes(q)
    );
  }, [devices, search]);

  return (
    <AdminCard>
      <AdminCardHeader
        icon={Fingerprint}
        title="Biometric Trusted Devices"
        description="Every user's enrolled devices. Revoke one to help a staff member who's lost their phone — they can re-enroll on their next device."
        actions={
          <Button variant="ghost" size="sm" className="h-7 rounded-none px-2" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />
      <AdminCardBody className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or device…"
          className="h-9 rounded-none"
        />

        {loading ? (
          <p className="border border-black/10 p-3 text-xs text-slate-500">Loading devices…</p>
        ) : filtered.length === 0 ? (
          <p className="border border-black/10 p-3 text-xs text-slate-500">
            {devices.length === 0 ? 'No users have enrolled a biometric device yet.' : 'No devices match your search.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((d) => (
              <div key={d.id} className="flex flex-col gap-2 border border-black/10 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-black">{d.user_name}</p>
                    {d.user_email && <p className="truncate text-xs text-slate-400">{d.user_email}</p>}
                  </div>
                  <AdminPill tone="success" className="shrink-0">Active</AdminPill>
                </div>

                <div className="border-t border-black/5 pt-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-black">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#00BAAD]" />
                    <span className="truncate">{d.device_label}</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {formatDeviceLocation(d)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {d.platform || d.user_agent || 'Unknown platform'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Last login {d.last_used_at ? new Date(d.last_used_at).toLocaleString() : 'never'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Enrolled {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 w-full rounded-none border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => revoke(d)}
                  disabled={busyId === d.id}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Revoke Device
                </Button>
              </div>
            ))}
          </div>
        )}
      </AdminCardBody>
    </AdminCard>
  );
};
