import { useEffect, useState } from 'react';
import { Fingerprint, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { enrollTrustedDevice, fetchServerDevices, isTrustedDeviceEnrolled, revokeServerDevice, ServerTrustedDevice } from '@/utils/trustedDevice';

export const BiometricTrustedDeviceCard = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<ServerTrustedDevice[]>([]); const [busy, setBusy] = useState(false);
  const load = async () => { if (user?.id) setDevices(await fetchServerDevices(user.id)); };
  useEffect(() => { load(); }, [user?.id]);
  const enroll = async () => { if (!user?.email) return; setBusy(true); await enrollTrustedDevice({ userId: user.id, userEmail: user.email, label: navigator.platform || 'Trusted device' }); await load(); setBusy(false); };
  const revoke = async (id: string) => { setBusy(true); await revokeServerDevice(id, 'Revoked by user'); await load(); setBusy(false); };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5" />Biometric trusted devices</CardTitle><CardDescription>Manage optional device-level biometric unlock. Password sign-in remains available.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium">This device</p><p className="text-sm text-muted-foreground">{isTrustedDeviceEnrolled(user?.email) ? 'Biometric unlock is enabled here.' : 'Biometric unlock is not enabled on this browser.'}</p></div>{!isTrustedDeviceEnrolled(user?.email) && <Button onClick={enroll} disabled={busy}>Enable on this device</Button>}</div><div className="space-y-2"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Enrolled devices</p><Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button></div>{devices.length === 0 ? <p className="text-sm text-muted-foreground">No trusted devices enrolled.</p> : devices.map((d) => <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border p-3"><div className="min-w-0"><p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-teal-600" />{d.device_label}</p><p className="truncate text-xs text-muted-foreground">{d.platform || d.user_agent || 'Unknown platform'} · Last used {d.last_used_at ? new Date(d.last_used_at).toLocaleString() : 'never'}</p></div><Button variant="outline" size="sm" onClick={() => revoke(d.id)} disabled={busy}><Trash2 className="mr-1 h-4 w-4" />Revoke</Button></div>)}</div></CardContent></Card>;
};
