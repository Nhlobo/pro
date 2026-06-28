import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Trash2, Loader2, Plus, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface TrustedDevice {
  id: string;
  device_name: string | null;
  user_agent: string | null;
  ip_address: string | null;
  last_seen_at: string;
  expires_at: string;
  created_at: string;
}

const DEVICE_TOKEN_KEY = 'mlp_trusted_device_token';

const detectDeviceName = () => {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  let browser = 'Browser';
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edg/.test(ua)) browser = 'Edge';
  let os = 'Device';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS';
  return `${browser} on ${os}${isMobile ? ' (Mobile)' : ''}`;
};

const sha256 = async (s: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const TrustedDevices: React.FC = () => {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentTokenHash, setCurrentTokenHash] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trusted_devices')
      .select('*')
      .order('last_seen_at', { ascending: false });
    if (error) toast.error('Failed to load devices');
    else setDevices((data as TrustedDevice[]) || []);

    const token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (token) setCurrentTokenHash(await sha256(token));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const trustThis = async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not signed in'); return; }

      let token = localStorage.getItem(DEVICE_TOKEN_KEY);
      if (!token) {
        token = crypto.randomUUID() + '-' + crypto.randomUUID();
        localStorage.setItem(DEVICE_TOKEN_KEY, token);
      }
      const hash = await sha256(token);
      const { error } = await supabase.from('trusted_devices').insert({
        user_id: user.id,
        device_token_hash: hash,
        device_name: detectDeviceName(),
        user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
      toast.success('This device is now trusted for 30 days');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Could not trust device');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string, isCurrent: boolean) => {
    if (!confirm('Revoke this device? You\'ll need to re-verify when signing in from it.')) return;
    const { error } = await supabase.from('trusted_devices').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (isCurrent) localStorage.removeItem(DEVICE_TOKEN_KEY);
    toast.success('Device revoked');
    load();
  };

  const isMobile = (ua: string | null) => ua && /Mobi|Android|iPhone|iPad/i.test(ua);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Trusted Devices
            </CardTitle>
            <CardDescription>
              Devices you mark as trusted skip the second-factor challenge for 30 days.
            </CardDescription>
          </div>
          <Button size="sm" onClick={trustThis} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Trust this device
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
          </div>
        ) : devices.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No trusted devices yet. Click "Trust this device" to add the one you're using.
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => {
              const Icon = isMobile(d.user_agent) ? Smartphone : Monitor;
              const isCurrent = currentTokenHash !== null; // best-effort marker handled per-row below
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-md bg-background flex items-center justify-center border">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {d.device_name || 'Unknown device'}
                        {isCurrent && <Badge variant="secondary" className="ml-2 text-[10px]">This device</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Last seen {formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true })}
                        {' · expires '}
                        {formatDistanceToNow(new Date(d.expires_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revoke(d.id, isCurrent)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrustedDevices;
