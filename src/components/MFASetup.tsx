import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldCheck, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Two-Factor Authentication (TOTP) enrollment & management.
 * Required for accounts that handle medical records, ID copies, and
 * medico-legal reports under POPIA Section 19 safeguards.
 */
export const MFASetup: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enrolledFactor, setEnrolledFactor] = useState<{ id: string; friendly_name?: string } | null>(null);
  const [pending, setPending] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error('Failed to load MFA status');
    } else {
      const verified = data?.totp?.find(f => f.status === 'verified') ?? null;
      setEnrolledFactor(verified ? { id: verified.id, friendly_name: verified.friendly_name } : null);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const startEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message || 'Could not start enrollment');
      return;
    }
    setPending({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!pending) return;
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter the 6-digit code from your authenticator');
      return;
    }
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: pending.factorId });
    if (chErr || !ch) { setBusy(false); toast.error(chErr?.message || 'Challenge failed'); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: pending.factorId, challengeId: ch.id, code });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Two-factor authentication enabled');
    setPending(null);
    setCode('');
    refresh();
  };

  const unenroll = async () => {
    if (!enrolledFactor) return;
    if (!confirm('Disable two-factor authentication? This weakens your account security.')) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: enrolledFactor.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Two-factor authentication disabled');
    refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Two-Factor Authentication (POPIA Sec. 19)
            </CardTitle>
            <CardDescription>
              Required when accessing medical records, ID copies, and medico-legal reports.
            </CardDescription>
          </div>
          {!loading && (
            enrolledFactor ? (
              <Badge className="bg-green-100 text-green-800 border-0 gap-1"><ShieldCheck className="h-3 w-3" /> Enabled</Badge>
            ) : (
              <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Disabled</Badge>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : enrolledFactor ? (
          <div className="space-y-3">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Your account is protected</AlertTitle>
              <AlertDescription>
                You'll be asked for a 6-digit code from your authenticator app at sign-in.
              </AlertDescription>
            </Alert>
            <Button variant="outline" disabled={busy} onClick={unenroll}>
              Disable two-factor authentication
            </Button>
          </div>
        ) : pending ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>Scan with your authenticator</AlertTitle>
              <AlertDescription>
                Use Google Authenticator, Microsoft Authenticator, 1Password, or Authy.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <img src={pending.qr} alt="MFA QR code" className="w-44 h-44 border rounded-md bg-white p-2" />
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Or enter this secret manually:</p>
                <code className="block bg-muted px-2 py-1 rounded break-all">{pending.secret}</code>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Enter the 6-digit code</label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                className="max-w-[160px] tracking-widest text-center"
              />
            </div>
            <div className="flex gap-2">
              <Button disabled={busy || code.length !== 6} onClick={verifyEnroll}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Verify & enable
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => { setPending(null); setCode(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Two-factor authentication is not enabled</AlertTitle>
              <AlertDescription>
                Enable it now to safeguard sensitive personal and health data.
              </AlertDescription>
            </Alert>
            <Button disabled={busy} onClick={startEnroll}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enable two-factor authentication
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MFASetup;
